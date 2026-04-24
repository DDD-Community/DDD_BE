import { Injectable } from '@nestjs/common';

import { ApplicationStatus } from '../domain/application.status';
import { ApplicationDraft } from '../domain/application-draft.entity';
import { ApplicationForm } from '../domain/application-form.entity';
import { DraftWriteRepository } from '../infrastructure/draft.write.repository';
import { FormWriteRepository } from '../infrastructure/form.write.repository';
import type { ApplicationDraftFilter } from '../infrastructure/write.repository.type';

@Injectable()
export class ApplicationRepository {
  constructor(
    private readonly formWriteRepository: FormWriteRepository,
    private readonly draftWriteRepository: DraftWriteRepository,
  ) {}

  async saveForm({ form }: { form: ApplicationForm }) {
    return this.formWriteRepository.save({ form });
  }

  async findFormById({ id }: { id: number }) {
    return this.formWriteRepository.findOne({
      where: { id },
      includeUser: true,
      includeCohortPart: true,
    });
  }

  async findFormByUserAndPart({ userId, cohortPartId }: { userId: number; cohortPartId: number }) {
    return this.formWriteRepository.findOne({
      where: { userId, cohortPartId },
    });
  }

  async findFormsByFilter({
    cohortPartIds,
    status,
  }: {
    cohortPartIds?: number[];
    status?: ApplicationStatus;
  }) {
    return this.formWriteRepository.findMany({
      where: { cohortPartIds, status },
    });
  }

  async saveDraft({ draft }: { draft: ApplicationDraft }) {
    return this.draftWriteRepository.save({ draft });
  }

  async findDraftByUserAndPart({ userId, cohortPartId }: { userId: number; cohortPartId: number }) {
    const filter: ApplicationDraftFilter = { userId, cohortPartId };
    return this.draftWriteRepository.findOne({ where: filter });
  }

  async deleteDraftByUserAndPart({
    userId,
    cohortPartId,
  }: {
    userId: number;
    cohortPartId: number;
  }) {
    const filter: ApplicationDraftFilter = { userId, cohortPartId };
    await this.draftWriteRepository.softDelete({ where: filter });
  }

  async purgeExpiredPii({ cutoffDate }: { cutoffDate: Date }) {
    const terminalStatuses = [
      ApplicationStatus.서류불합격,
      ApplicationStatus.최종합격,
      ApplicationStatus.최종불합격,
      ApplicationStatus.활동완료,
      ApplicationStatus.활동중단,
    ];

    return this.formWriteRepository.nullifyPii({ terminalStatuses, cutoffDate });
  }
}
