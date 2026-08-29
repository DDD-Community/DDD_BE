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
    return this.repository.findOne({ where: this.buildWhere(where), relations });
  }

  async findMany({ where = {}, relations }: { where?: SlotFilter; relations?: string[] } = {}) {
    return this.repository.find({
      where: this.buildWhere(where),
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

  // QueryBuilder 는 soft delete 필터를 자동 적용하지 않으므로 deletedAt 조건을 명시한다.
  async findOneForUpdate({ id }: { id: number }) {
    return this.repository
      .createQueryBuilder('slot')
      .setLock('pessimistic_write')
      .where('slot.id = :id', { id })
      .andWhere('slot.deletedAt IS NULL')
      .getOne();
  }

  async countByCohortPartId({ cohortPartId }: { cohortPartId: number }): Promise<number> {
    return this.repository.count({ where: { cohortPartId } });
  }

  private buildWhere(filter: SlotFilter): FindOptionsWhere<InterviewSlot> {
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
