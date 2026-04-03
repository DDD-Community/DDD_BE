import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { FindOptionsWhere } from 'typeorm';

import { WriteRepository } from '../infrastructure/write.repository';
import { ApplicationStatus } from './application.status';
import { ApplicationDraft } from './application-draft.entity';
import { ApplicationForm } from './application-form.entity';

export class ApplicationAdminFilter {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cohortId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  cohortPartId?: number;

  @IsOptional()
  @IsEnum(ApplicationStatus)
  status?: ApplicationStatus;
}

@Injectable()
export class ApplicationRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async saveForm({ form }: { form: ApplicationForm }) {
    return this.writeRepository.saveForm({ form });
  }

  async findFormById({ id }: { id: number }) {
    return this.writeRepository.findOneForm({ where: { id } });
  }

  async findFormByUserAndPart({ userId, cohortPartId }: { userId: number; cohortPartId: number }) {
    return this.writeRepository.findOneForm({ where: { userId, cohortPartId } });
  }

  async findFormsWithFilter(filter: ApplicationAdminFilter) {
    const where: FindOptionsWhere<ApplicationForm> = {};
    if (filter.cohortPartId) where.cohortPartId = filter.cohortPartId;
    if (filter.status) where.status = filter.status;
    if (filter.cohortId) where.cohortPart = { cohort: { id: filter.cohortId } };

    return this.writeRepository.findForms({ where });
  }

  async saveDraft({ draft }: { draft: ApplicationDraft }) {
    const found = await this.writeRepository.findOneDraft({
      where: { userId: draft.userId, cohortPartId: draft.cohortPartId },
    });
    if (found) {
      found.answers = draft.answers;
      return this.writeRepository.saveDraftRecord({ draft: found });
    }
    return this.writeRepository.saveDraftRecord({ draft });
  }

  async findDraftByUserAndPart({ userId, cohortPartId }: { userId: number; cohortPartId: number }) {
    return this.writeRepository.findOneDraft({ where: { userId, cohortPartId } });
  }

  async deleteDraftByUserAndPart({
    userId,
    cohortPartId,
  }: {
    userId: number;
    cohortPartId: number;
  }) {
    await this.writeRepository.softDeleteDraft({ where: { userId, cohortPartId } });
  }
}
