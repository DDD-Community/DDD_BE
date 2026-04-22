import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Cohort } from '../../cohort/domain/cohort.entity';
import { BaseEntity } from '../../common/core/base.entity';

@Entity('early_notifications')
@Index('uq_early_notifications_active_cohort_email', ['cohortId', 'email'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class EarlyNotification extends BaseEntity {
  @ManyToOne(() => Cohort, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohortId' })
  cohort?: Cohort;

  @Column()
  cohortId: number;

  @Column()
  email: string;

  @Column({ type: 'timestamptz', nullable: true })
  notifiedAt: Date | null;

  static create({ cohortId, email }: { cohortId: number; email: string }): EarlyNotification {
    const notification = new EarlyNotification();
    notification.cohortId = cohortId;
    notification.email = email;
    notification.notifiedAt = null;
    return notification;
  }

  markNotified(now: Date = new Date()): void {
    this.notifiedAt = now;
  }
}
