import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class GmailEmailClient {
  private readonly logger = new Logger(GmailEmailClient.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail({ to, subject, html, text }: SendEmailPayload): Promise<void> {
    const provider = (this.configService.get<string>('EMAIL_PROVIDER') ?? 'console').toLowerCase();
    if (provider !== 'gmail') {
      this.logger.log(`[메일 미리보기] to=${this.maskEmail({ email: to })}, subject=${subject}`);
      return;
    }

    const user = this.configService.get<string>('GMAIL_USER');
    const pass = this.configService.get<string>('GMAIL_APP_PASSWORD');
    const from = this.configService.get<string>('EMAIL_FROM');

    if (!user || !pass || !from) {
      this.logger.error('EMAIL_PROVIDER=gmail 이지만 GMAIL_USER, GMAIL_APP_PASSWORD 또는 EMAIL_FROM이 누락되었습니다.');
      return;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    });

    await transporter.sendMail({ from, to, subject, html, text });
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
