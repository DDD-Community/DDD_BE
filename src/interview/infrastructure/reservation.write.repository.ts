import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { InterviewReservation } from '../domain/interview-reservation.entity';
import type { ReservationFilter } from './write.repository.type';

@Injectable()
export class ReservationWriteRepository {
  private readonly repository: Repository<InterviewReservation>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(InterviewReservation);
  }

  async save({
    reservation,
  }: {
    reservation: InterviewReservation;
  }): Promise<InterviewReservation> {
    return this.repository.save(reservation);
  }

  async findOne({ where, relations }: { where: ReservationFilter; relations?: string[] }) {
    return this.repository.findOne({ where: this.toWhereOptions(where), relations });
  }

  async findMany({
    where = {},
    relations,
  }: { where?: ReservationFilter; relations?: string[] } = {}) {
    return this.repository.find({
      where: this.toWhereOptions(where),
      relations,
      order: { createdAt: 'DESC' },
    });
  }

  async countActiveBySlotId({ slotId }: { slotId: number }): Promise<number> {
    return this.repository.count({ where: { slotId } });
  }

  async softDelete({ id }: { id: number }): Promise<void> {
    await this.repository.softDelete(id);
  }

  private toWhereOptions(filter: ReservationFilter): FindOptionsWhere<InterviewReservation> {
    const where: FindOptionsWhere<InterviewReservation> = {};
    if (filter.id !== undefined) {
      where.id = filter.id;
    }
    if (filter.slotId !== undefined) {
      where.slotId = filter.slotId;
    }
    if (filter.applicationFormId !== undefined) {
      where.applicationFormId = filter.applicationFormId;
    }
    return where;
  }
}
