import { Injectable, Logger } from '@nestjs/common';

import { EmailLog } from '../domain/email-log.entity';
import { NotificationRepository } from '../domain/notification.repository';
import { GmailEmailClient } from '../infrastructure/gmail-email.client';

type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type SendNotificationEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly gmailEmailClient: GmailEmailClient,
    private readonly notificationRepository: NotificationRepository,
  ) {}

  async sendEmail({
    to,
    subject,
    html,
    text,
    attachments,
  }: SendNotificationEmailPayload): Promise<void> {
    try {
      await this.gmailEmailClient.sendEmail({ to, subject, html, text, attachments });

      const log = EmailLog.createSuccess({ recipientEmail: to, subject });
      await this.notificationRepository.saveLog({ log });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const log = EmailLog.createFailure({ recipientEmail: to, subject, errorMessage });
      await this.notificationRepository.saveLog({ log });

      this.logger.error(`이메일 발송 실패: to=${to}, subject=${subject}`, errorMessage);
      throw error;
    }
  }
}
