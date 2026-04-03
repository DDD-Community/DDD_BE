import { Injectable } from '@nestjs/common';
import { DataSource, In, LessThan, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType } from '../domain/cohort.type';

type CohortFindCondition = {
  id?: number;
  status?: CohortStatus;
};

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<Cohort>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Cohort);
  }

  async create({ cohort }: { cohort: CohortCreateType }) {
    return this.repository.save(cohort);
  }

  async save({ cohort }: { cohort: Cohort }) {
    return this.repository.save(cohort);
  }

  async exists({ statuses }: { statuses: CohortStatus[] }) {
    return this.repository.exists({ where: { status: In(statuses) } });
  }

  async find(condition: CohortFindCondition = {}) {
    return this.repository.find({ where: condition, relations: { parts: true } });
  }

  async findOne(condition: CohortFindCondition) {
    return this.repository.findOne({ where: condition, relations: { parts: true } });
  }

  async findOneByStatuses({ statuses }: { statuses: CohortStatus[] }) {
    return this.repository.findOne({
      where: statuses.map((status) => ({ status })),
      relations: { parts: true },
    });
  }

  async findByStatusBefore({ status, date }: { status: CohortStatus; date: Date }) {
    return this.repository.find({ where: { status, recruitEndAt: LessThan(date) } });
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
    await this.repository.update(id, { name, recruitStartAt, recruitEndAt, status });
  }

  async softDelete({ id }: { id: number }) {
    await this.repository.softDelete(id);
  }
}
