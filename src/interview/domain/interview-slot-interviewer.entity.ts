import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import { User } from '../../user/domain/user.entity';
import { InterviewSlot } from './interview-slot.entity';

@Entity('interview_slot_interviewers')
@Unique('UQ_interview_slot_interviewers_slot_user', ['slotId', 'userId'])
@Index('IDX_interview_slot_interviewers_host', ['slotId'], {
  unique: true,
  where: '"isHost" = true',
})
export class InterviewSlotInterviewer extends BaseEntity {
  @ManyToOne(() => InterviewSlot, (slot) => slot.interviewers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'slotId' })
  slot: InterviewSlot;

  @Column()
  slotId: number;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: number;

  @Column({ default: false })
  isHost: boolean;

  @Column()
  position: number;
}
