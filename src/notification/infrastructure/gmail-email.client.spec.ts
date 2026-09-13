import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as nodemailer from 'nodemailer';

import { GmailEmailClient } from './gmail-email.client';

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

const createClient = async (env: Record<string, string>): Promise<GmailEmailClient> => {
  const module = await Test.createTestingModule({
    providers: [
      GmailEmailClient,
      { provide: ConfigService, useValue: { get: (key: string) => env[key] } },
    ],
  }).compile();

  return module.get(GmailEmailClient);
};

const emailPayload = {
  to: 'applicant@example.com',
  subject: '[DDD] 14기 모집 시작 안내',
  html: '<p>모집이 시작되었습니다.</p>',
  text: '모집이 시작되었습니다.',
};

const gmailEnv = {
  NODE_ENV: 'production',
  EMAIL_PROVIDER: 'gmail',
  GMAIL_USER: 'noreply@dddstudy.kr',
  GMAIL_APP_PASSWORD: 'app-password',
  EMAIL_FROM: 'noreply@dddstudy.kr',
};

describe('GmailEmailClient', () => {
  const sendMail = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    sendMail.mockResolvedValue(undefined);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });
  });

  // 운영에서 console 모드가 조용히 성공하던 동작이 사전 알림 메일 미발송의 원인이었다.
  // 호출자는 예외가 없는 것을 성공으로 보고 EmailLog 를 SUCCESS 로 남기고 notifiedAt 까지 찍어,
  // 한 통도 나가지 않았는데 어드민 화면에는 '발송 완료' 로 보였다.
  describe('운영에서 발송 불가 상태를 성공으로 기록하지 않는다', () => {
    it('EMAIL_PROVIDER 가 gmail 이 아니면 예외를 던진다', async () => {
      const client = await createClient({ NODE_ENV: 'production', EMAIL_PROVIDER: 'console' });

      await expect(client.sendEmail(emailPayload)).rejects.toThrow('EMAIL_PROVIDER=console');
      expect(sendMail).not.toHaveBeenCalled();
    });

    it('EMAIL_PROVIDER 미설정이어도 예외를 던진다', async () => {
      const client = await createClient({ NODE_ENV: 'production' });

      await expect(client.sendEmail(emailPayload)).rejects.toThrow(
        '운영 메일을 발송할 수 없습니다',
      );
    });

    it('EMAIL_PROVIDER=gmail 인데 자격증명이 비면 예외를 던진다', async () => {
      const client = await createClient({
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'gmail',
        GMAIL_USER: 'noreply@dddstudy.kr',
      });

      await expect(client.sendEmail(emailPayload)).rejects.toThrow('GMAIL_APP_PASSWORD');
      expect(sendMail).not.toHaveBeenCalled();
    });
  });

  it('로컬 개발에서는 console 모드로 로그만 남기고 통과한다', async () => {
    const client = await createClient({ NODE_ENV: 'development', EMAIL_PROVIDER: 'console' });

    await expect(client.sendEmail(emailPayload)).resolves.toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('자격증명이 모두 있으면 Gmail 로 발송한다', async () => {
    const client = await createClient(gmailEnv);

    await client.sendEmail(emailPayload);

    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      service: 'gmail',
      auth: { user: gmailEnv.GMAIL_USER, pass: gmailEnv.GMAIL_APP_PASSWORD },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { name: 'DDD', address: gmailEnv.EMAIL_FROM },
        to: emailPayload.to,
        subject: emailPayload.subject,
      }),
    );
  });

  it('html 조각은 문서로 감싸고, 이미 완성된 문서는 다시 감싸지 않는다', async () => {
    const client = await createClient(gmailEnv);
    const fullDocument = '<!DOCTYPE html>\n<html lang="ko"><body>본문</body></html>';

    await client.sendEmail(emailPayload);
    await client.sendEmail({ ...emailPayload, html: fullDocument });

    const [fragmentCall, documentCall] = sendMail.mock.calls.map(
      ([options]) => (options as { html: string }).html,
    );
    expect(fragmentCall).toBe(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>모집이 시작되었습니다.</p></body></html>',
    );
    // 공용 레이아웃이 <!DOCTYPE html> 로 시작하므로 감싸면 html 이 중첩된다.
    expect(documentCall).toBe(fullDocument);
  });

  it('발송이 실패하면 예외를 그대로 전파한다', async () => {
    sendMail.mockRejectedValue(new Error('Invalid login'));
    const client = await createClient(gmailEnv);

    await expect(client.sendEmail(emailPayload)).rejects.toThrow('Invalid login');
  });
});
