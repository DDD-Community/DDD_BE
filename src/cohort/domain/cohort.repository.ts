import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import { Cohort } from './cohort.entity';
import { CohortStatus } from './cohort.status';
import type { CohortCreateType } from './cohort.type';

@Injectable()
export class CohortRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async register({ cohort }: { cohort: CohortCreateType }) {
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

  async findActive() {
    return this.writeRepository.findOneByStatuses({
      statuses: [CohortStatus.RECRUITING, CohortStatus.ACTIVE],
    });
  }

  async findExpiredRecruiting() {
    return this.writeRepository.findByStatusBefore({
      status: CohortStatus.RECRUITING,
      date: new Date(),
    });
  }

  async findAll() {
    return this.writeRepository.find();
  }

  async update({
    id,
    name,
    recruitStartAt,
    recruitEndAt,
    status,
  }: {
    id: number;
    name?: string;
    recruitStartAt?: Date;
    recruitEndAt?: Date;
    status?: CohortStatus;
  }) {
    await this.writeRepository.update({ id, name, recruitStartAt, recruitEndAt, status });
  }

  async save({ cohort }: { cohort: Cohort }) {
    return this.writeRepository.save({ cohort });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ id });
  }
}
