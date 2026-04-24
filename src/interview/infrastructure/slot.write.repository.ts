import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { InterviewSlot } from '../domain/interview-slot.entity';
import type { SlotFilter, SlotUpdatePatch } from './write.repository.type';

@Injectable()
export class SlotWriteRepository {
  private readonly repository: Repository<InterviewSlot>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(InterviewSlot);
  }

  async save({ slot }: { slot: InterviewSlot }): Promise<InterviewSlot> {
    return this.repository.save(slot);
  }

  async findOne({ where, relations }: { where: SlotFilter; relations?: string[] }) {
    return this.repository.findOne({ where: this.toWhereOptions(where), relations });
  }

  async findMany({ where = {}, relations }: { where?: SlotFilter; relations?: string[] } = {}) {
    return this.repository.find({
      where: this.toWhereOptions(where),
      relations,
      order: { startAt: 'ASC' },
    });
  }

  async update({ id, patch }: { id: number; patch: SlotUpdatePatch }): Promise<void> {
    const defined = filterDefinedFields(patch);
    if (Object.keys(defined).length === 0) {
      return;
    }
    await this.repository.update(id, defined);
  }

  async softDelete({ id }: { id: number }): Promise<void> {
    await this.repository.softDelete(id);
  }

  async countByCohortPartId({ cohortPartId }: { cohortPartId: number }): Promise<number> {
    return this.repository.count({ where: { cohortPartId } });
  }

  private toWhereOptions(filter: SlotFilter): FindOptionsWhere<InterviewSlot> {
    const where: FindOptionsWhere<InterviewSlot> = {};
    if (filter.id !== undefined) {
      where.id = filter.id;
    }
    if (filter.cohortId !== undefined) {
      where.cohortId = filter.cohortId;
    }
    if (filter.cohortPartId !== undefined) {
      where.cohortPartId = filter.cohortPartId;
    }
    return where;
  }
}
