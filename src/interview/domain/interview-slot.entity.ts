import { Column, Entity, JoinColumn, ManyToOne, OneToMany } from 'typeorm';

import { Cohort } from '../../cohort/domain/cohort.entity';
import { CohortPart } from '../../cohort/domain/cohort-part.entity';
import { BaseEntity } from '../../common/core/base.entity';
import type { InterviewSlotCreateInput, InterviewSlotUpdatePatch } from './interview.type';
import { InterviewReservation } from './interview-reservation.entity';

@Entity('interview_slots')
export class InterviewSlot extends BaseEntity {
  @ManyToOne(() => Cohort, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cohortId' })
  cohort: Cohort;

  @Column()
  cohortId: number;

  @ManyToOne(() => CohortPart, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cohortPartId' })
  cohortPart: CohortPart;

  @Column()
  cohortPartId: number;

  @Column()
  startAt: Date;

  @Column()
  endAt: Date;

  @Column({ default: 1 })
  capacity: number;

  /** 예약 확정 시 지원자에게 메일·캘린더로 전달된다. 온라인 면접이면 미팅 링크가 들어간다. */
  @Column()
  location: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @OneToMany(() => InterviewReservation, (reservation) => reservation.slot)
  reservations: InterviewReservation[];

  static create(input: InterviewSlotCreateInput): InterviewSlot {
    const slot = new InterviewSlot();
    slot.cohortId = input.cohortId;
    slot.cohortPartId = input.cohortPartId;
    slot.startAt = input.startAt;
    slot.endAt = input.endAt;
    slot.capacity = input.capacity;
    slot.location = input.location;
    if (input.description) {
      slot.description = input.description;
    }
    return slot;
  }

  update(patch: InterviewSlotUpdatePatch): void {
    if (patch.startAt !== undefined) {
      this.startAt = patch.startAt;
    }
    if (patch.endAt !== undefined) {
      this.endAt = patch.endAt;
    }
    if (patch.capacity !== undefined) {
      this.capacity = patch.capacity;
    }
    if (patch.location !== undefined) {
      this.location = patch.location;
    }
    if (patch.description !== undefined) {
      this.description = patch.description;
    }
  }
}
