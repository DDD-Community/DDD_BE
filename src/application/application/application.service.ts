import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transactional } from 'typeorm-transactional';

import { CohortService } from '../../cohort/application/cohort.service';
import { AppException } from '../../common/exception/app.exception';
import { ApplicationAdminFilter, ApplicationRepository } from '../domain/application.repository';
import { ApplicationDraft } from '../domain/application-draft.entity';
import { ApplicationForm } from '../domain/application-form.entity';
import {
  SaveApplicationDraftRequestDto,
  SubmitApplicationRequestDto,
  UpdateApplicationStatusRequestDto,
} from '../interface/dto/application.request.dto';

@Injectable()
export class ApplicationService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly cohortService: CohortService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Transactional()
  async saveDraft(
    { userId }: { userId: number },
    command: SaveApplicationDraftRequestDto,
  ): Promise<void> {
    const cohortPart = await this.cohortService.findPartById(command.cohortPartId);
    if (!cohortPart || !cohortPart.isOpen) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
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
    command: SubmitApplicationRequestDto,
  ): Promise<void> {
    if (!command.privacyAgreed) {
      throw new AppException('PRIVACY_AGREEMENT_REQUIRED', HttpStatus.BAD_REQUEST);
    }

    const cohortPart = await this.cohortService.findPartById(command.cohortPartId);
    if (!cohortPart || !cohortPart.isOpen) {
      throw new AppException('COHORT_PART_CLOSED', HttpStatus.BAD_REQUEST);
    }

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

    this.eventEmitter.emit('application.submitted', {
      email,
      name: command.applicantName,
    });
  }

  @Transactional()
  async updateStatus(
    formId: number,
    adminId: number,
    command: UpdateApplicationStatusRequestDto,
  ): Promise<void> {
    const form = await this.applicationRepository.findFormById({ id: formId });
    if (!form) {
      throw new AppException('APPLICATION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    form.changeStatus(command.status, adminId);

    await this.applicationRepository.saveForm({ form });

    this.eventEmitter.emit('application.status_changed', {
      email: form.user.email,
      name: form.applicantName,
      newStatus: form.status,
    });
  }

  async findForms(filter: ApplicationAdminFilter) {
    return this.applicationRepository.findFormsWithFilter(filter);
  }

  async findFormById(id: number) {
    return this.applicationRepository.findFormById({ id });
  }
}
