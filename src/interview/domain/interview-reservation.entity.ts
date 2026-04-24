import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { InterviewSlot } from './interview-slot.entity';

@Entity('interview_reservations')
@Index('uq_interview_reservations_application_active', ['applicationFormId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('uq_interview_reservations_slot_application_active', ['slotId', 'applicationFormId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class InterviewReservation extends BaseEntity {
  @ManyToOne(() => InterviewSlot, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'slotId' })
  slot: InterviewSlot;

  @Column()
  slotId: number;

  @Column()
  applicationFormId: number;

  @Column({ nullable: true })
  calendarEventId?: string;

  static create({
    slotId,
    applicationFormId,
  }: {
    slotId: number;
    applicationFormId: number;
  }): InterviewReservation {
    const reservation = new InterviewReservation();
    reservation.slotId = slotId;
    reservation.applicationFormId = applicationFormId;
    return reservation;
  }

  assignCalendarEvent(eventId: string): void {
    this.calendarEventId = eventId;
  }
}
