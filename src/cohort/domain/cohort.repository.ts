import { Injectable } from '@nestjs/common';

import { Cohort } from '../domain/cohort.entity';
import type { CohortUpdatePatch } from '../domain/cohort.repository.type';
import { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType } from '../domain/cohort.type';
import { PartWriteRepository } from '../infrastructure/part.write.repository';
import { WriteRepository } from '../infrastructure/write.repository';

@Injectable()
export class CohortRepository {
  constructor(
    private readonly writeRepository: WriteRepository,
    private readonly partWriteRepository: PartWriteRepository,
  ) {}

  async register({ cohort }: { cohort: CohortCreateType }) {
    return this.writeRepository.save({ cohort });
  }

  async checkActiveCohortExists() {
    return this.writeRepository.exists({
      where: {
        statusIn: [CohortStatus.UPCOMING, CohortStatus.RECRUITING],
      },
    });
  }

  async checkActiveCohortExistsExcept({ id }: { id: number }) {
    return this.writeRepository.exists({
      where: {
        statusIn: [CohortStatus.UPCOMING, CohortStatus.RECRUITING],
        excludedId: id,
      },
    });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id }, includeParts: true });
  }

  async findPartById({ id }: { id: number }) {
    return this.partWriteRepository.findOne({ where: { id } });
  }

  async findActive() {
    return this.writeRepository.findMany({
      where: {
        statusIn: [CohortStatus.RECRUITING, CohortStatus.UPCOMING, CohortStatus.ACTIVE],
      },
      includeParts: true,
    });
  }

  async findExpiredRecruiting() {
    return this.writeRepository.findMany({
      where: {
        status: CohortStatus.RECRUITING,
        recruitEndAtLt: new Date(),
      },
      includeParts: true,
    });
  }

  async findUpcomingToRecruiting() {
    return this.writeRepository.findMany({
      where: {
        status: CohortStatus.UPCOMING,
        recruitStartAtLte: new Date(),
      },
      includeParts: true,
    });
  }

  async findAll() {
    return this.writeRepository.findMany({ where: {}, includeParts: true });
  }

  async update({
    id,
    name,
    recruitStartAt,
    recruitEndAt,
    process,
    curriculum,
    applicationForm,
    status,
  }: { id: number } & CohortUpdatePatch) {
    await this.writeRepository.update({
      id,
      patch: { name, recruitStartAt, recruitEndAt, process, curriculum, applicationForm, status },
    });
  }

  async save({ cohort }: { cohort: Cohort }) {
    return this.writeRepository.save({ cohort });
  }

  async deleteById({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }
}
