import { Injectable } from '@nestjs/common';
import {
  DataSource,
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  MoreThan,
  Not,
  Repository,
} from 'typeorm';

import { filterDefinedFields } from '../../common/util/object-utils';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import type { SlotFilter, SlotUpdatePatch } from './write.repository.type';

@Injectable()
export class SlotWriteRepository {
  private readonly repository: Repository<InterviewSlot>;
  private readonly dataSource: DataSource;

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
    this.repository = dataSource.getRepository(InterviewSlot);
  }

  async withMeetingLock({
    slotId,
    work,
  }: {
    slotId: number;
    work: () => Promise<void>;
  }): Promise<void> {
    const runner = this.dataSource.createQueryRunner();
    let locked = false;
    try {
      await runner.connect();
      const rows = (await runner.query('SELECT pg_try_advisory_lock($1, $2) AS locked', [
        7101,
        slotId,
      ])) as Array<{ locked: boolean }>;
      locked = rows[0]?.locked === true;
      if (locked) {
        await work();
      }
    } finally {
      try {
        if (locked) {
          await runner.query('SELECT pg_advisory_unlock($1, $2)', [7101, slotId]);
        }
      } finally {
        await runner.release();
      }
    }
  }

  async acquireHostTimeLock({ hostUserId }: { hostUserId: number }): Promise<void> {
    await this.repository.manager.query('SELECT pg_advisory_xact_lock($1, $2)', [7102, hostUserId]);
  }

  async save({ slot }: { slot: InterviewSlot }): Promise<InterviewSlot> {
    return this.repository.save(slot);
  }

  async findOne({
    where,
    relations,
    withDeleted = false,
  }: {
    where: SlotFilter;
    relations?: string[];
    withDeleted?: boolean;
  }) {
    return this.repository.findOne({ where: this.buildWhere(where), relations, withDeleted });
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

  async updateMeetingState({
    slotId,
    patch,
    revision,
    bumpRevision = false,
  }: {
    slotId: number;
    revision?: number;
    bumpRevision?: boolean;
    patch: Partial<
      Pick<
        InterviewSlot,
        | 'meetingStatus'
        | 'calendarOwnerUserId'
        | 'calendarEventId'
        | 'meetUrl'
        | 'meetingGeneration'
        | 'meetingRetryCount'
        | 'meetingSyncedAt'
        | 'meetingLastError'
      >
    >;
  }): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder()
      .update(InterviewSlot)
      .set({
        ...patch,
        ...(bumpRevision ? { meetingRevision: () => '"meetingRevision" + 1' } : {}),
      })
      .where('id = :slotId', { slotId });
    if (revision !== undefined) {
      query.andWhere('"meetingRevision" = :revision', { revision });
    }
    const result = await query.execute();
    return (result.affected ?? 0) > 0;
  }

  async findRetryCandidates({
    now,
    limit,
  }: {
    now: Date;
    limit: number;
  }): Promise<InterviewSlot[]> {
    return this.repository.find({
      withDeleted: true,
      where: [
        {
          deletedAt: IsNull(),
          meetingStatus: In([
            InterviewSlotMeetingStatus.PENDING,
            InterviewSlotMeetingStatus.FAILED,
            InterviewSlotMeetingStatus.OUT_OF_SYNC,
          ]),
          endAt: MoreThan(now),
          meetingRetryCount: LessThan(10),
        },
        {
          deletedAt: Not(IsNull()),
          calendarEventId: Not(IsNull()),
          meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC,
          meetingRetryCount: LessThan(10),
        },
      ],
      order: { startAt: 'ASC' },
      take: limit,
    });
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
