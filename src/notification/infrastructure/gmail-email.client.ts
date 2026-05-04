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

    const normalizedHtml = html.trimStart().toLowerCase().startsWith('<html')
      ? html
      : `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

    // 첨부가 없으면 1×1 투명 PNG 더미를 추가해 multipart/mixed 구조로 강제한다.
    // 일부 한국 이메일 뷰어(Naver/Daum/카카오 등)가 multipart/alternative
    // 최상위 구조에서 한글을 깨뜨리는 문제를 회피하기 위함이다.
    // (면접 이메일이 ICS 첨부 덕에 multipart/mixed 가 되어 정상 동작하는 것이 근거)
    const TRANSPARENT_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const finalAttachments =
      attachments && attachments.length > 0
        ? attachments
        : [{ filename: 'spacer.png', content: TRANSPARENT_PNG, contentType: 'image/png' }];

    await transporter.sendMail({
      from: { name: fromName, address: fromAddress },
      to,
      subject,
      html: normalizedHtml,
      text,
      attachments: finalAttachments,
      textEncoding: 'quoted-printable',
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
