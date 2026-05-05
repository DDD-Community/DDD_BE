import { Injectable } from '@nestjs/common';

import { NotificationCampaignWriteRepository } from '../infrastructure/notification-campaign.write.repository';
import {
  NotificationCampaign,
  NotificationCampaignSendResult,
} from './notification-campaign.entity';
import { NotificationCampaignStatus } from './notification-campaign.status';

@Injectable()
export class NotificationCampaignRepository {
  constructor(private readonly writeRepository: NotificationCampaignWriteRepository) {}

  async register({
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
  }) {
    const campaign = NotificationCampaign.create({ cohortId, scheduledAt, subject, html, text });
    return this.writeRepository.save({ campaign });
  }

  async registerDraft({
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
  }) {
    const campaign = NotificationCampaign.createDraft({
      cohortId,
      scheduledAt,
      subject,
      html,
      text,
    });
    return this.writeRepository.save({ campaign });
  }

  async save({ campaign }: { campaign: NotificationCampaign }) {
    return this.writeRepository.save({ campaign });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id } });
  }

  async findByCohort({
    cohortId,
    status,
  }: {
    cohortId: number;
    status?: NotificationCampaignStatus;
  }) {
    return this.writeRepository.findMany({ where: { cohortId, status } });
  }

  async findDueScheduled({ now }: { now: Date }) {
    return this.writeRepository.findMany({
      where: { status: NotificationCampaignStatus.SCHEDULED, scheduledAtLte: now },
    });
  }

  async findStaleRunning({ updatedAtBefore }: { updatedAtBefore: Date }) {
    return this.writeRepository.findMany({
      where: { status: NotificationCampaignStatus.RUNNING, updatedAtLt: updatedAtBefore },
    });
  }

  async deleteById({ id }: { id: number }): Promise<void> {
    return this.writeRepository.softDeleteById({ id });
  }

  async transitionStatus({
    id,
    fromStatus,
    toStatus,
    patch,
  }: {
    id: number;
    fromStatus: NotificationCampaignStatus;
    toStatus: NotificationCampaignStatus;
    patch?: { sentAt?: Date | null; result?: NotificationCampaignSendResult | null };
  }): Promise<boolean> {
    return this.writeRepository.transitionStatus({ id, fromStatus, toStatus, patch });
  }
}
