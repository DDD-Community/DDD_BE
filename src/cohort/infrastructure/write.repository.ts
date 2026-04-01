import { Injectable } from '@nestjs/common';
import { DataSource, In, LessThan, Repository } from 'typeorm';

import { Cohort } from '../domain/cohort.entity';
import { CohortStatus } from '../domain/cohort.status';
import type { CohortCreateType, CohortUpdateType } from '../domain/cohort.type';

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

  async find() {
    return this.repository.find({ relations: { parts: true } });
  }

  async findOne({ id }: { id?: number }) {
    return this.repository.findOne({ where: { id }, relations: { parts: true } });
  }

  async findOneByStatuses({ statuses }: { statuses: CohortStatus[] }) {
    return this.repository.findOne({
      where: statuses.map((status) => ({ status })),
      relations: { parts: true },
    });
  }

  async findExpiredRecruiting() {
    return this.repository.find({
      where: {
        status: CohortStatus.RECRUITING,
        recruitEndAt: LessThan(new Date()),
      },
    });
  }

  async update({ id, ...data }: { id: number } & CohortUpdateType) {
    await this.repository.update(id, data);
  }

  async softDelete({ id }: { id: number }) {
    await this.repository.softDelete(id);
  }
}
