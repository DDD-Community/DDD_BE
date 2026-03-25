import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { CohortRepository } from '../domain/cohort.repository';
import type { CohortCreateType } from '../domain/cohort.type';

@Injectable()
export class CohortService {
  constructor(private readonly cohortRepository: CohortRepository) {}

  @Transactional()
  async createCohort({ cohort }: { cohort: CohortCreateType }) {
    const isExists = await this.cohortRepository.checkActiveCohortExists();
    if (isExists) {
      throw new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT);
    }

    return this.cohortRepository.create({ cohort });
  }
}
