import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import type { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType } from '../domain/cohort.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<Cohort>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Cohort);
  }

  async create({ cohort }: { cohort: CohortCreateType }) {
    return this.repository.save(cohort);
  }

  async exists({ statuses }: { statuses?: CohortStatus[] }) {
    return this.repository.exists({
      where: statuses && statuses.length > 0 ? { status: In(statuses) } : {},
    });
  }

  async findOne({ id }: { id: number }) {
    return this.repository.findOne({ where: { id }, relations: ['parts'] });
  }
}
