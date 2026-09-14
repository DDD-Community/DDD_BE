import { createHash, createHmac } from 'node:crypto';

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';

import { AuthService } from '../../auth/application/auth.service';
import { AppException } from '../../common/exception/app.exception';
import { NotificationService } from '../../notification/application/notification.service';
import { UserService } from '../../user/application/user.service';
import { ApplicationEmailVerification } from '../domain/application-email-verification.entity';
import { ApplicationEmailVerificationRepository } from '../domain/application-email-verification.repository';
import { ApplicationVerificationService } from './application-verification.service';

const email = 'Applicant@Example.com';
const normalizedEmail = 'applicant@example.com';
const code = '123456';
const jwtSecret = 'test-jwt-secret';
const hashKey = createHash('sha256').update(`applicant-verification:${jwtSecret}`).digest();
const hash = createHmac('sha256', hashKey).update(code).digest('hex');

const makeVerification = (
  overrides: Partial<ApplicationEmailVerification> = {},
): ApplicationEmailVerification => {
  const verification = ApplicationEmailVerification.create({
    email: normalizedEmail,
    codeHash: hash,
    expiresAt: new Date(Date.now() + 60_000),
  });
  Object.assign(verification, {
    id: 1,
    createdAt: new Date(Date.now() - 120_000),
    ...overrides,
  });
  return verification;
};

describe('ApplicationVerificationService', () => {
  let service: ApplicationVerificationService;
  const repository = {
    save: jest.fn(),
    findLatestByEmail: jest.fn(),
    findLatestUnconsumedByEmail: jest.fn(),
    acquireEmailLock: jest.fn(),
    consumeAllUnconsumedByEmail: jest.fn(),
    deleteConsumedOrExpiredBefore: jest.fn(),
  };
  const notificationService = { sendEmail: jest.fn() };
  const userService = { register: jest.fn() };
  const authService = { signApplicantToken: jest.fn() };
  const configService = { getOrThrow: jest.fn().mockReturnValue(jwtSecret) };

  beforeEach(() => {
    service = new ApplicationVerificationService(
      repository as unknown as ApplicationEmailVerificationRepository,
      notificationService as unknown as NotificationService,
      userService as unknown as UserService,
      authService as unknown as AuthService,
      configService as unknown as ConfigService,
    );
    jest.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    repository.findLatestByEmail.mockResolvedValue(null);
    repository.findLatestUnconsumedByEmail.mockResolvedValue(null);
    repository.acquireEmailLock.mockResolvedValue(undefined);
    repository.consumeAllUnconsumedByEmail.mockResolvedValue(undefined);
    notificationService.sendEmail.mockResolvedValue(undefined);
    authService.signApplicantToken.mockReturnValue('applicant-token');
  });

  beforeAll(() => {
    initializeTransactionalContext();
    addTransactionalDataSource({
      name: 'default',
      dataSource: {
        transaction: async (callback: (manager: unknown) => unknown) => await callback({}),
      },
      patch: false,
    } as never);
  });

  describe('requestCode', () => {
    it('Given 최근 요청이 없으면 When 인증번호를 요청할 때 Then 해시를 저장하고 이메일을 발송한다', async () => {
      await service.requestCode({ email });

      expect(repository.acquireEmailLock).toHaveBeenCalledWith({ email: normalizedEmail });
      expect(repository.findLatestByEmail).toHaveBeenCalledWith({
        email: normalizedEmail,
        lock: true,
      });
      expect(repository.save).toHaveBeenCalledWith({ verification: expect.any(Object) });
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: normalizedEmail,
          subject: '[DDD] 이메일 인증번호를 안내드립니다',
        }),
      );
      const sent = notificationService.sendEmail.mock.calls.at(-1)[0] as {
        html: string;
        text: string;
      };
      const code = /인증번호를 입력해 주세요\.\n\n(\d{6})\n/.exec(sent.text)?.[1];
      expect(code).toMatch(/^\d{6}$/);
      expect(sent.html).toContain(code);
      expect(sent.text).toContain('인증번호는 발급 후 10분간 유효합니다.');
      const saved = repository.save.mock.calls.at(-1)[0]
        .verification as ApplicationEmailVerification;
      expect(saved.codeHash).toHaveLength(64);
    });

    it('Given 60초 이내 요청이 있으면 When 다시 요청할 때 Then cooldown 오류를 반환한다', async () => {
      repository.findLatestByEmail.mockResolvedValue(makeVerification({ createdAt: new Date() }));

      await expect(service.requestCode({ email })).rejects.toMatchObject({
        errorCode: 'VERIFICATION_COOLDOWN',
      } satisfies Partial<AppException>);
      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    });

    // 발송 실패는 204 로 넘어가므로(review-fixes.spec 의 계약) 화면에는 성공으로 보인다.
    // 원인이 로그에 남지 않으면 "메일이 안 온다" 는 제보를 받고도 추적할 방법이 없다.
    it('Given 메일 발송이 실패하면 When 인증번호를 요청할 때 Then 실패 원인을 로그에 남긴다', async () => {
      const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      notificationService.sendEmail.mockRejectedValue(
        new Error('Daily user sending limit exceeded'),
      );

      await service.requestCode({ email });

      expect(loggerError).toHaveBeenCalledWith(
        expect.stringContaining('인증 메일 발송 실패'),
        expect.stringContaining('Daily user sending limit exceeded'),
      );
      loggerError.mockRestore();
    });
  });

  describe('confirmCode', () => {
    it('Given 올바른 인증번호가 있으면 When 확인할 때 Then 세션용 사용자를 만들고 인증번호를 소비한다', async () => {
      const verification = makeVerification();
      repository.findLatestUnconsumedByEmail.mockResolvedValue(verification);
      userService.register.mockResolvedValue({ user: { id: 12 } });

      await expect(service.confirmCode({ email, code })).resolves.toEqual({
        accessToken: 'applicant-token',
        email: normalizedEmail,
      });

      expect(verification.consumedAt).toBeInstanceOf(Date);
      expect(userService.register).toHaveBeenCalledWith({
        email: normalizedEmail,
        firstName: 'applicant',
        sub: `applicant:${normalizedEmail}`,
        restoreDeleted: false,
      });
    });

    it('Given 틀린 인증번호가 있으면 When 확인할 때 Then 시도 횟수를 늘리고 invalid 오류를 반환한다', async () => {
      const verification = makeVerification();
      repository.findLatestUnconsumedByEmail.mockResolvedValue(verification);

      await expect(service.confirmCode({ email, code: '654321' })).rejects.toMatchObject({
        errorCode: 'VERIFICATION_CODE_INVALID',
      } satisfies Partial<AppException>);

      expect(repository.save).toHaveBeenCalledWith({ verification });
      expect(verification.attemptCount).toBe(1);
      expect(userService.register).not.toHaveBeenCalled();
    });

    it('Given 다섯 번 초과한 인증번호가 있으면 When 확인할 때 Then expired 오류를 반환한다', async () => {
      repository.findLatestUnconsumedByEmail.mockResolvedValue(
        makeVerification({ attemptCount: 5 }),
      );

      await expect(service.confirmCode({ email, code })).rejects.toMatchObject({
        errorCode: 'VERIFICATION_CODE_EXPIRED',
      } satisfies Partial<AppException>);
    });
  });
});
