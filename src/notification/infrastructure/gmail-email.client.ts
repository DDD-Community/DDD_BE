import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type EmailAttachment = {
  filename: string;
  content: string | Buffer;
  contentType?: string;
};

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

@Injectable()
export class GmailEmailClient {
  private readonly logger = new Logger(GmailEmailClient.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail({ to, subject, html, text, attachments }: SendEmailPayload): Promise<void> {
    const provider = (this.configService.get<string>('EMAIL_PROVIDER') ?? 'console').toLowerCase();
    if (provider !== 'gmail') {
      const attachmentSuffix = attachments?.length ? `, attachments=${attachments.length}` : '';
      this.logger.log(
        `[메일 미리보기] to=${this.maskEmail({ email: to })}, subject=${subject}${attachmentSuffix}`,
      );
      return;
    }

    const user = this.configService.get<string>('GMAIL_USER');
    const pass = this.configService.get<string>('GMAIL_APP_PASSWORD');
    const fromAddress = this.configService.get<string>('EMAIL_FROM');
    const fromName = this.configService.get<string>('EMAIL_FROM_NAME') ?? 'DDD';

    if (!user || !pass || !fromAddress) {
      this.logger.error(
        'EMAIL_PROVIDER=gmail 이지만 GMAIL_USER, GMAIL_APP_PASSWORD 또는 EMAIL_FROM이 누락되었습니다.',
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to,
      subject,
      html,
      text,
      attachments,
    });
  }

  private maskEmail({ email }: { email: string }): string {
    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) {
      return 'masked-email';
    }

    if (localPart.length <= 2) {
      return `${localPart[0] ?? '*'}*@${domain}`;
    }

    const visiblePrefix = localPart.slice(0, 2);
    return `${visiblePrefix}***@${domain}`;
  }
}
