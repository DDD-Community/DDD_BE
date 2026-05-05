import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { EarlyNotificationService } from './application/early-notification.service';
import { GeneralEarlyNotificationService } from './application/general-early-notification.service';
import { NotificationService } from './application/notification.service';
import { NotificationCampaignService } from './application/notification-campaign.service';
import { EarlyNotification } from './domain/early-notification.entity';
import { EarlyNotificationRepository } from './domain/early-notification.repository';
import { EmailLog } from './domain/email-log.entity';
import { GeneralEarlyNotification } from './domain/general-early-notification.entity';
import { GeneralEarlyNotificationRepository } from './domain/general-early-notification.repository';
import { NotificationRepository } from './domain/notification.repository';
import { NotificationCampaign } from './domain/notification-campaign.entity';
import { NotificationCampaignRepository } from './domain/notification-campaign.repository';
import { EarlyNotificationWriteRepository } from './infrastructure/early-notification.write.repository';
import { EmailLogWriteRepository } from './infrastructure/email-log.write.repository';
import { GeneralEarlyNotificationWriteRepository } from './infrastructure/general-early-notification.write.repository';
import { GmailEmailClient } from './infrastructure/gmail-email.client';
import { NotificationCampaignScheduler } from './infrastructure/notification-campaign.scheduler';
import { NotificationCampaignWriteRepository } from './infrastructure/notification-campaign.write.repository';
import { AdminEarlyNotificationController } from './interface/admin.early-notification.controller';
import { AdminNotificationCampaignController } from './interface/admin.notification-campaign.controller';
import { PublicEarlyNotificationController } from './interface/public.early-notification.controller';
import { PublicGeneralEarlyNotificationController } from './interface/public.general-early-notification.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EmailLog,
      EarlyNotification,
      GeneralEarlyNotification,
      NotificationCampaign,
    ]),
    forwardRef(() => CohortModule),
    AuditModule,
  ],
  controllers: [
    PublicEarlyNotificationController,
    PublicGeneralEarlyNotificationController,
    AdminEarlyNotificationController,
    AdminNotificationCampaignController,
  ],
  providers: [
    NotificationService,
    NotificationRepository,
    GmailEmailClient,
    EmailLogWriteRepository,
    EarlyNotificationService,
    EarlyNotificationRepository,
    EarlyNotificationWriteRepository,
    GeneralEarlyNotificationService,
    GeneralEarlyNotificationRepository,
    GeneralEarlyNotificationWriteRepository,
    NotificationCampaignService,
    NotificationCampaignRepository,
    NotificationCampaignWriteRepository,
    NotificationCampaignScheduler,
    RolesGuard,
  ],
  exports: [
    NotificationService,
    EarlyNotificationService,
    GeneralEarlyNotificationService,
    NotificationCampaignService,
  ],
})
export class NotificationModule {}
