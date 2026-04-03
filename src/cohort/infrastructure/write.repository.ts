import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType } from '../domain/cohort.type';
import { CohortPart } from '../domain/cohort-part.entity';

type CohortUpdateData = {
  name?: string;
  recruitStartAt?: Date;
  recruitEndAt?: Date;
  status?: CohortStatus;
};

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<Cohort>;
  private readonly partRepository: Repository<CohortPart>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(Cohort);
    this.partRepository = dataSource.getRepository(CohortPart);
  }

  async save({ cohort }: { cohort: Cohort | CohortCreateType }) {
    return this.repository.save(cohort);
  }

  async findOne({ where }: { where: FindOptionsWhere<Cohort> }) {
    return this.repository.findOne({ where, relations: { parts: true } });
  }

  async find({ where }: { where?: FindOptionsWhere<Cohort> } = {}) {
    return this.repository.find({ where, relations: { parts: true } });
  }

  async exists({ where }: { where: FindOptionsWhere<Cohort> }) {
    return this.repository.exists({ where });
  }

  async findOnePart({ where }: { where: FindOptionsWhere<CohortPart> }) {
    return this.partRepository.findOne({ where });
  }

  async update({ id, data }: { id: number; data: CohortUpdateData }) {
    await this.repository.update(id, data);
  }

  async softDelete({ where }: { where: FindOptionsWhere<Cohort> }) {
    await this.repository.softDelete(where);
  }
}
