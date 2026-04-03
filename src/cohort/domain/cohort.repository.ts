import { Injectable } from '@nestjs/common';
import { In, LessThan } from 'typeorm';

import { WriteRepository } from '../infrastructure/write.repository';
import { Cohort } from './cohort.entity';
import { CohortStatus } from './cohort.status';
import type { CohortCreateType } from './cohort.type';

@Injectable()
export class CohortRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async register({ cohort }: { cohort: CohortCreateType }) {
    return this.writeRepository.save({ cohort });
  }

  async checkActiveCohortExists() {
    return this.writeRepository.exists({
      where: { status: In([CohortStatus.PLANNED, CohortStatus.RECRUITING]) },
    });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id } });
  }

  async findPartById(id: number) {
    return this.writeRepository.findOnePart({ where: { id } });
  }

  async findActive() {
    return this.writeRepository.findOne({
      where: { status: In([CohortStatus.RECRUITING, CohortStatus.ACTIVE]) },
    });
  }

  async findExpiredRecruiting() {
    return this.writeRepository.find({
      where: { status: CohortStatus.RECRUITING, recruitEndAt: LessThan(new Date()) },
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
    await this.writeRepository.update({ id, data: { name, recruitStartAt, recruitEndAt, status } });
  }

  async save({ cohort }: { cohort: Cohort }) {
    return this.writeRepository.save({ cohort });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }
}
