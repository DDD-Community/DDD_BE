import { forwardRef, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { runOnTransactionCommit, Transactional } from 'typeorm-transactional';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import type { CohortPart } from '../../cohort/domain/cohort-part.entity';
import { isRecruitmentOpenAt } from '../../cohort/domain/cohort-recruitment';
import { AppException } from '../../common/exception/app.exception';
import { InterviewService } from '../../interview/application/interview.service';
import { InvalidApplicationStatusTransitionError } from '../domain/application.domain-error';
import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import type {
  SaveDraftCommand,
  SubmitFormCommand,
  UpdateStatusCommand,
} from '../domain/application.type';
import { ApplicationDraft } from '../domain/application-draft.entity';
import { ApplicationForm } from '../domain/application-form.entity';
import { ApplicationAnswerValidator } from './application-answer.validator';
import { ApplicationAttachmentService } from './application-attachment.service';

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly cohortRepository: CohortRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly applicationAnswerValidator: ApplicationAnswerValidator,
    private readonly applicationAttachmentService: ApplicationAttachmentService,
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService: InterviewService,
  ) {}

  /**
   * 파트가 열려 있고 소속 기수의 모집 기간 안일 때만 접수를 허용한다.
   * isOpen 만 보면 모집 시작 전·종료 후에도 지원서가 저장되므로 기수 일정까지 확인한다.
   */
  private isApplicationOpen(cohortPart: CohortPart | null): cohortPart is CohortPart {
    if (!cohortPart?.isOpen || !cohortPart.cohort) {
      return false;
    }

    return isRecruitmentOpenAt({ cohort: cohortPart.cohort, now: new Date() });
  }

  @Transactional()
  async saveDraft({ userId }: { userId: number }, command: SaveDraftCommand): Promise<void> {
    const cohortPart = await this.cohortRepository.findPartById({ id: command.cohortPartId });
    if (!this.isApplicationOpen(cohortPart)) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
    }

    this.applicationAttachmentService.assertAttachmentsOwnedByUser({
      userId,
      answers: command.answers,
    });

    const found = await this.applicationRepository.findDraftByUserAndPart({
      userId,
      cohortPartId: cohortPart.id,
    });

    if (found) {
      found.answers = command.answers;
      await this.applicationRepository.saveDraft({ draft: found });
      return;
    }

    const draft = ApplicationDraft.create({
      userId,
      cohortPartId: cohortPart.id,
      answers: command.answers,
    });
    await this.applicationRepository.saveDraft({ draft });
  }

  @Transactional()
  async submitForm(
    { userId, email }: { userId: number; email: string },
    command: SubmitFormCommand,
  ): Promise<void> {
    if (!command.privacyAgreed) {
      throw new AppException('PRIVACY_AGREEMENT_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const cohortPart = await this.cohortRepository.findPartById({ id: command.cohortPartId });
    if (!this.isApplicationOpen(cohortPart)) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
    }
    this.applicationAttachmentService.assertAttachmentsOwnedByUser({
      userId,
      answers: command.answers,
    });
    await this.applicationAttachmentService.assertAttachmentsExist({ answers: command.answers });
    this.applicationAnswerValidator.validate({
      answers: command.answers,
      schema: cohortPart.applicationSchema,
    });

    const found = await this.applicationRepository.findFormByUserAndPart({
      userId,
      cohortPartId: cohortPart.id,
    });
    if (found) {
      throw new AppException('ALREADY_SUBMITTED', HttpStatus.CONFLICT);
    }

    const form = ApplicationForm.create({
      userId,
      cohortPartId: cohortPart.id,
      applicantName: command.applicantName,
      applicantPhone: command.applicantPhone,
      applicantBirthDate: command.applicantBirthDate,
      applicantRegion: command.applicantRegion,
      answers: command.answers,
      privacyAgreedAt: new Date(),
    });

    await this.applicationRepository.saveForm({ form });

    await this.applicationRepository.deleteDraftByUserAndPart({
      userId,
      cohortPartId: cohortPart.id,
    });

    this.logger.log(`지원서 최종 제출: userId=${userId}, cohortPartId=${cohortPart.id}`);

    runOnTransactionCommit(() => {
      this.eventEmitter.emit('application.submitted', {
        email,
        name: command.applicantName,
      });
    });
  }

  @Transactional()
  async updateStatus(
    { formId, adminId }: { formId: number; adminId: number },
    command: UpdateStatusCommand,
  ): Promise<void> {
    const form = await this.applicationRepository.findFormById({ id: formId });
    if (!form) {
      throw new AppException('APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (command.status === ApplicationStatus.서류합격) {
      const hasSlots = await this.interviewService.hasSlotsForCohortPart({
        cohortPartId: form.cohortPartId,
      });
      if (!hasSlots) {
        throw new AppException('INTERVIEW_SLOTS_NOT_READY', HttpStatus.BAD_REQUEST);
      }
    }

    try {
      form.changeStatus(command.status, adminId);
    } catch (error) {
      if (error instanceof InvalidApplicationStatusTransitionError) {
        throw new AppException('INVALID_STATUS_TRANSITION', HttpStatus.BAD_REQUEST);
      }
      throw error;
    }

    await this.applicationRepository.saveForm({ form });

    this.logger.log(
      `지원서 상태 변경: formId=${formId}, status=${command.status}, adminId=${adminId}`,
    );

    runOnTransactionCommit(() => {
      this.eventEmitter.emit('application.status_changed', {
        email: form.user.email,
        name: form.applicantName,
        newStatus: form.status,
      });
    });
  }

  /**
   * 기수 종료 시 활동중 지원자를 활동완료로 일괄 전환한다.
   * 활동완료는 개별 버튼이 아니라 기수 종료로만 도달하는 상태라 이 경로가 유일한 진입점이다.
   * 활동중단(중도 이탈)은 이미 확정된 결과이므로 건드리지 않는다.
   */
  @Transactional()
  async completeActivitiesForCohort({
    cohortId,
    adminId,
  }: {
    cohortId: number;
    adminId: number;
  }): Promise<number> {
    const cohort = await this.cohortRepository.findById({ id: cohortId });
    const cohortPartIds = cohort?.parts?.map((part) => part.id) ?? [];
    if (cohortPartIds.length === 0) {
      return 0;
    }

    const forms = await this.applicationRepository.findFormsByFilter({
      cohortPartIds,
      status: ApplicationStatus.활동중,
    });

    for (const form of forms) {
      form.changeStatus(ApplicationStatus.활동완료, adminId);
      await this.applicationRepository.saveForm({ form });
    }

    if (forms.length > 0) {
      this.logger.log(`기수 종료로 활동완료 전환: cohortId=${cohortId}, count=${forms.length}`);
    }
    return forms.length;
  }

  async findDraftByPart({ userId, cohortPartId }: { userId: number; cohortPartId: number }) {
    const draft = await this.applicationRepository.findDraftByUserAndPart({ userId, cohortPartId });
    if (!draft) {
      throw new AppException('APPLICATION_DRAFT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return draft;
  }

  async findFormById({ id }: { id: number }) {
    const form = await this.applicationRepository.findFormById({ id });
    if (!form) {
      throw new AppException('APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return form;
  }
}
