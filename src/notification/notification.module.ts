import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { EarlyNotificationService } from './application/early-notification.service';
import { NotificationService } from './application/notification.service';
import { EarlyNotification } from './domain/early-notification.entity';
import { EarlyNotificationRepository } from './domain/early-notification.repository';
import { EmailLog } from './domain/email-log.entity';
import { NotificationRepository } from './domain/notification.repository';
import { EarlyNotificationWriteRepository } from './infrastructure/early-notification.write.repository';
import { EmailLogWriteRepository } from './infrastructure/email-log.write.repository';
import { GmailEmailClient } from './infrastructure/gmail-email.client';
import { AdminEarlyNotificationController } from './interface/admin.early-notification.controller';
import { PublicEarlyNotificationController } from './interface/public.early-notification.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog, EarlyNotification]), CohortModule],
  controllers: [PublicEarlyNotificationController, AdminEarlyNotificationController],
  providers: [
    NotificationService,
    NotificationRepository,
    GmailEmailClient,
    EmailLogWriteRepository,
    EarlyNotificationService,
    EarlyNotificationRepository,
    EarlyNotificationWriteRepository,
    RolesGuard,
  ],
  exports: [NotificationService, EarlyNotificationService],
})
export class NotificationModule {}
