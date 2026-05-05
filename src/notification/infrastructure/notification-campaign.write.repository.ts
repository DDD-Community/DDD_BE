import { Injectable } from '@nestjs/common';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';

import {
  NotificationCampaign,
  NotificationCampaignSendResult,
} from '../domain/notification-campaign.entity';
import { NotificationCampaignStatus } from '../domain/notification-campaign.status';
import type { NotificationCampaignFilter } from './notification-campaign.write.repository.type';

@Injectable()
export class NotificationCampaignWriteRepository {
  private readonly repository: Repository<NotificationCampaign>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(NotificationCampaign);
  }

  async save({ campaign }: { campaign: NotificationCampaign }) {
    return this.repository.save(campaign);
  }

  async findOne({ where }: { where: NotificationCampaignFilter }) {
    return this.repository.findOne({ where: this.buildWhere(where) });
  }

  async findMany({ where }: { where: NotificationCampaignFilter }) {
    return this.repository.find({
      where: this.buildWhere(where),
      order: { scheduledAt: 'ASC' },
    });
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
    const updateResult = await this.repository.update(
      { id, status: fromStatus },
      { status: toStatus, ...patch },
    );
    return (updateResult.affected ?? 0) > 0;
  }

  private buildWhere(filter: NotificationCampaignFilter) {
    const where: Record<string, unknown> = {};

    if (filter.id !== undefined) {
      where.id = filter.id;
    }

    if (filter.cohortId !== undefined) {
      where.cohortId = filter.cohortId;
    }

    if (filter.status !== undefined) {
      where.status = filter.status;
    }

    if (filter.scheduledAtLte !== undefined) {
      where.scheduledAt = LessThanOrEqual(filter.scheduledAtLte);
    }

    return where;
  }
}
