import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';

import { Cohort } from '../../cohort/domain/cohort.entity';
import { BaseEntity } from '../../common/core/base.entity';
import { NotificationCampaignStatus } from './notification-campaign.status';

export type NotificationCampaignSendResult = {
  total: number;
  success: number;
  failed: number;
};

@Entity('notification_campaigns')
@Index(['cohortId', 'status'])
@Index(['status', 'scheduledAt'])
export class NotificationCampaign extends BaseEntity {
  @ManyToOne(() => Cohort, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cohortId' })
  cohort?: Cohort;

  @Column()
  cohortId: number;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  html: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({
    type: 'enum',
    enum: NotificationCampaignStatus,
    default: NotificationCampaignStatus.SCHEDULED,
  })
  status: NotificationCampaignStatus;

  @Column({ type: 'jsonb', nullable: true })
  result: NotificationCampaignSendResult | null;

  static create({
    cohortId,
    scheduledAt,
    subject,
    html,
    text,
  }: {
    cohortId: number;
    scheduledAt: Date;
    subject: string;
    html: string;
    text: string;
  }): NotificationCampaign {
    const campaign = new NotificationCampaign();
    campaign.cohortId = cohortId;
    campaign.scheduledAt = scheduledAt;
    campaign.subject = subject;
    campaign.html = html;
    campaign.text = text;
    campaign.status = NotificationCampaignStatus.SCHEDULED;
    campaign.sentAt = null;
    campaign.result = null;
    return campaign;
  }

  applyEdits({
    scheduledAt,
    subject,
    html,
    text,
  }: {
    scheduledAt?: Date;
    subject?: string;
    html?: string;
    text?: string;
  }): void {
    if (scheduledAt !== undefined) {
      this.scheduledAt = scheduledAt;
    }
    if (subject !== undefined) {
      this.subject = subject;
    }
    if (html !== undefined) {
      this.html = html;
    }
    if (text !== undefined) {
      this.text = text;
    }
  }
}
