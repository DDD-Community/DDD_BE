import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendEmailPayload = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class ResendEmailClient {
  private readonly logger = new Logger(ResendEmailClient.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail({ to, subject, html, text }: SendEmailPayload): Promise<void> {
    const provider = (this.configService.get<string>('EMAIL_PROVIDER') ?? 'console').toLowerCase();
    if (provider !== 'resend') {
      this.logger.log(`[메일 미리보기] to=${this.maskEmail({ email: to })}, subject=${subject}`);
      return;
    }

    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('EMAIL_FROM');

    if (!apiKey || !from) {
      this.logger.error(
        'EMAIL_PROVIDER=resend 이지만 RESEND_API_KEY 또는 EMAIL_FROM이 누락되었습니다.',
      );
      return;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend 전송 실패: status=${response.status}`);
    }
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
