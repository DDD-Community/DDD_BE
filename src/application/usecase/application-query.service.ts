import { Injectable } from '@nestjs/common';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { ApplicationRepository } from '../domain/application.repository';
import type { ApplicationAdminFilter } from '../domain/application.type';

@Injectable()
export class ApplicationQueryService {
  constructor(
    private readonly applicationRepository: ApplicationRepository,
    private readonly cohortRepository: CohortRepository,
  ) {}

  async findFormsWithFilter({ cohortId, cohortPartId, status }: ApplicationAdminFilter) {
    const resolvedPartIds = await this.resolvePartIds({ cohortId, cohortPartId });

    return this.applicationRepository.findFormsByFilter({
      cohortPartIds: resolvedPartIds,
      status,
    });
  }

  private async resolvePartIds({
    cohortId,
    cohortPartId,
  }: {
    cohortId?: number;
    cohortPartId?: number;
  }): Promise<number[] | undefined> {
    if (cohortPartId !== undefined) {
      return [cohortPartId];
    }

    if (cohortId !== undefined) {
      const cohort = await this.cohortRepository.findById({ id: cohortId });
      if (!cohort) {
        return [];
      }
      return (cohort.parts ?? []).map((part: { id: number }) => part.id);
    }

    return undefined;
  }
}
