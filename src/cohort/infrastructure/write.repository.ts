import { Injectable } from '@nestjs/common';
import type { FindOptionsWhere } from 'typeorm';
import { DataSource, In, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import type { CohortUpdatePatch } from '../domain/cohort.repository.type';
import type { CohortCreateType } from '../domain/cohort.type';
import type { CohortExistsQuery, CohortFilter } from './write.repository.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<Cohort>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Cohort);
  }

  async save({ cohort }: { cohort: Cohort | CohortCreateType }) {
    return this.repository.save(cohort);
  }

  async findOne({ where, includeParts }: { where: CohortFilter; includeParts?: boolean }) {
    return this.repository.findOne({
      where: this.toWhereOptions(where),
      relations: includeParts ? { parts: true } : undefined,
    });
  }

  async findMany({
    where = {},
    includeParts,
  }: { where?: CohortFilter; includeParts?: boolean } = {}) {
    return this.repository.find({
      where: this.toWhereOptions(where),
      relations: includeParts ? { parts: true } : undefined,
    });
  }

  async exists({ where }: { where: CohortExistsQuery }) {
    return this.repository.exists({ where: this.toWhereOptions(where) });
  }

  async update({ id, patch }: { id: number; patch: CohortUpdatePatch }) {
    const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined));
    if (Object.keys(defined).length === 0) {
      return;
    }
    await this.repository.update(id, defined);
  }

  async softDelete({ where }: { where: CohortFilter }) {
    const whereOptions = this.toWhereOptions(where);

    if (this.isEmptyWhere(whereOptions)) {
      throw new Error('Cohort softDelete requires at least one where condition.');
    }

    await this.repository.softDelete(whereOptions);
  }

  private toWhereOptions(filter: CohortFilter): FindOptionsWhere<Cohort> {
    const where: FindOptionsWhere<Cohort> = {};
    const idCondition = this.resolveIdCondition(filter);
    const statusCondition = this.resolveStatusCondition(filter);

    if (idCondition !== undefined) {
      where.id = idCondition;
    }

    if (statusCondition !== undefined) {
      where.status = statusCondition;
    }

    if (filter.recruitStartAtLte !== undefined) {
      where.recruitStartAt = LessThanOrEqual(filter.recruitStartAtLte);
    }

    if (filter.recruitEndAtLt !== undefined) {
      where.recruitEndAt = LessThan(filter.recruitEndAtLt);
    }

    return where;
  }

  private resolveIdCondition({
    id,
    excludedId,
  }: Pick<CohortFilter, 'id' | 'excludedId'>): FindOptionsWhere<Cohort>['id'] | undefined {
    if (id !== undefined) {
      return id;
    }

    if (excludedId !== undefined) {
      return Not(excludedId);
    }

    return undefined;
  }

  private resolveStatusCondition({
    status,
    statusIn,
  }: Pick<CohortFilter, 'status' | 'statusIn'>): FindOptionsWhere<Cohort>['status'] | undefined {
    if (statusIn?.length) {
      return In(statusIn);
    }

    if (status !== undefined) {
      return status;
    }

    return undefined;
  }

  private isEmptyWhere(where: FindOptionsWhere<Cohort>) {
    return Object.keys(where).length === 0;
  }
}
