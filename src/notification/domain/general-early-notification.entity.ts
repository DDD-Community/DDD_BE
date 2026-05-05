import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Cohort } from '../../cohort/domain/cohort.entity';
import { BaseEntity } from '../../common/core/base.entity';

@Entity('general_early_notifications')
@Index('uq_general_early_notifications_active_pending_email', ['email'], {
  unique: true,
  where: '"deletedAt" IS NULL AND "promotedAt" IS NULL',
})
export class GeneralEarlyNotification extends BaseEntity {
  @Column()
  email: string;

  @Column({ type: 'timestamptz', nullable: true })
  promotedAt: Date | null;

  @ManyToOne(() => Cohort, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'promotedToCohortId' })
  promotedToCohort?: Cohort | null;

  @Column({ nullable: true })
  promotedToCohortId: number | null;

  static create({ email }: { email: string }): GeneralEarlyNotification {
    const notification = new GeneralEarlyNotification();
    notification.email = email;
    notification.promotedAt = null;
    notification.promotedToCohortId = null;
    return notification;
  }
}
