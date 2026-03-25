import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import { CohortStatus } from './cohort.status';
import type { CohortCreateType } from './cohort.type';

@Injectable()
export class CohortRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async create({ cohort }: { cohort: CohortCreateType }) {
    return this.writeRepository.create({ cohort });
  }

  async checkActiveCohortExists() {
    return this.writeRepository.exists({
      statuses: [CohortStatus.PLANNED, CohortStatus.RECRUITING],
    });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ id });
  }
}
