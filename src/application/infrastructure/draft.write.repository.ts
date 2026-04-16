import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ApplicationDraft } from '../domain/application-draft.entity';
import type { ApplicationDraftFilter } from './write.repository.type';

type DraftWhereBuilder = {
  andWhere: (where: string, parameters?: Record<string, unknown>) => unknown;
};

@Injectable()
export class DraftWriteRepository {
  private readonly repository: Repository<ApplicationDraft>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(ApplicationDraft);
  }

  async save({ draft }: { draft: ApplicationDraft }) {
    return this.repository.save(draft);
  }

  async findOne({ where }: { where: ApplicationDraftFilter }) {
    const queryBuilder = this.createQueryBuilder();
    this.applyFilter({ queryBuilder, filter: where });
    return queryBuilder.getOne();
  }

  async softDelete({ where }: { where: ApplicationDraftFilter }) {
    if (this.isEmptyFilter(where)) {
      throw new Error('ApplicationDraft softDelete requires at least one where condition.');
    }

    const queryBuilder = this.repository.createQueryBuilder('draft').softDelete();
    this.applyFilter({ queryBuilder, filter: where, alias: 'draft' });
    await queryBuilder.execute();
  }

  private createQueryBuilder() {
    return this.repository.createQueryBuilder('draft');
  }

  private applyFilter({
    queryBuilder,
    filter,
    alias = 'draft',
  }: {
    queryBuilder: DraftWhereBuilder;
    filter: ApplicationDraftFilter;
    alias?: string;
  }) {
    if (filter.id !== undefined) {
      queryBuilder.andWhere(`${alias}.id = :id`, { id: filter.id });
    }

    if (filter.userId !== undefined) {
      queryBuilder.andWhere(`${alias}.userId = :userId`, { userId: filter.userId });
    }

    if (filter.cohortPartId !== undefined) {
      queryBuilder.andWhere(`${alias}.cohortPartId = :cohortPartId`, {
        cohortPartId: filter.cohortPartId,
      });
    }
  }

  private isEmptyFilter(filter: ApplicationDraftFilter) {
    return Object.values(filter).every((value) => value === undefined);
  }
}
