import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { NotificationCampaignService } from '../application/notification-campaign.service';

@Injectable()
export class NotificationCampaignScheduler {
  private readonly logger = new Logger(NotificationCampaignScheduler.name);

  constructor(private readonly notificationCampaignService: NotificationCampaignService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runDueCampaigns(): Promise<void> {
    this.logger.log('사전 알림 캠페인 스케줄러 실행');
    await this.notificationCampaignService.runDueCampaigns();
  }
}
