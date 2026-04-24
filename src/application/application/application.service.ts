import { forwardRef, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { runOnTransactionCommit, Transactional } from 'typeorm-transactional';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
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

@Injectable()
export class ApplicationService {
  private readonly logger = new Logger(ApplicationService.name);

  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly cohortRepository: CohortRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly applicationAnswerValidator: ApplicationAnswerValidator,
    @Inject(forwardRef(() => InterviewService))
    private readonly interviewService: InterviewService,
  ) {}

  @Transactional()
  async saveDraft({ userId }: { userId: number }, command: SaveDraftCommand): Promise<void> {
    const cohortPart = await this.cohortRepository.findPartById({ id: command.cohortPartId });
    if (!cohortPart || !cohortPart.isOpen) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
    }

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
    if (!cohortPart || !cohortPart.isOpen) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
    }
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
        throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.BAD_REQUEST);
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
