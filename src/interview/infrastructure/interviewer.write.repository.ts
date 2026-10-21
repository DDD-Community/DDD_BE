import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { InterviewSlotInterviewer } from '../domain/interview-slot-interviewer.entity';

@Injectable()
export class InterviewerWriteRepository {
  private readonly repository: Repository<InterviewSlotInterviewer>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(InterviewSlotInterviewer);
  }

  async replace({ slotId, userIds }: { slotId: number; userIds: number[] }): Promise<void> {
    await this.repository.delete({ slotId });
    if (userIds.length === 0) {
      return;
    }
    const rows = userIds.map((userId, position) =>
      this.repository.create({ slotId, userId, position, isHost: position === 0 }),
    );
    await this.repository.save(rows);
  }

  async hasHostOverlap({
    hostUserId,
    startAt,
    endAt,
    excludeSlotId,
  }: {
    hostUserId: number;
    startAt: Date;
    endAt: Date;
    excludeSlotId?: number;
  }): Promise<boolean> {
    const query = this.repository
      .createQueryBuilder('interviewer')
      .innerJoin('interviewer.slot', 'slot')
      .where('interviewer.userId = :hostUserId', { hostUserId })
      .andWhere('interviewer.isHost = true')
      .andWhere('interviewer.deletedAt IS NULL')
      .andWhere('slot.deletedAt IS NULL')
      .andWhere('slot.startAt < :endAt AND slot.endAt > :startAt', { startAt, endAt });
    if (excludeSlotId !== undefined) {
      query.andWhere('slot.id != :excludeSlotId', { excludeSlotId });
    }
    return (await query.getCount()) > 0;
  }
}
