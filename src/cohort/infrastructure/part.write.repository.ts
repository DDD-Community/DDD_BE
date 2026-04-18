import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { CohortPart } from '../domain/cohort-part.entity';

@Injectable()
export class PartWriteRepository {
  private readonly repository: Repository<CohortPart>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(CohortPart);
  }

  async findOne({ where }: { where: { id: number } }) {
    return this.repository
      .createQueryBuilder('part')
      .innerJoin('part.cohort', 'cohort', 'cohort.deletedAt IS NULL')
      .where('part.id = :id', { id: where.id })
      .andWhere('part.deletedAt IS NULL')
      .getOne();
  }
}
