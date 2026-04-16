import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationService } from './application/notification.service';
import { EmailLog } from './domain/email-log.entity';
import { EmailLogWriteRepository } from './infrastructure/email-log.write.repository';
import { ResendEmailClient } from './infrastructure/resend-email.client';

@Module({
  imports: [TypeOrmModule.forFeature([EmailLog])],
  providers: [NotificationService, ResendEmailClient, EmailLogWriteRepository],
  exports: [NotificationService],
})
export class NotificationModule {}
