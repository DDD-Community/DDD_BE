import { createHash } from 'node:crypto';

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
const hash = createHash('sha256').update(code).digest('hex');

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
    incrementAttemptCount: jest.fn(),
    consumeAllUnconsumedByEmail: jest.fn(),
    deleteConsumedOrExpiredBefore: jest.fn(),
  };
  const notificationService = { sendEmail: jest.fn() };
  const userService = { register: jest.fn() };
  const authService = { signApplicantToken: jest.fn() };

  beforeEach(() => {
    service = new ApplicationVerificationService(
      repository as unknown as ApplicationEmailVerificationRepository,
      notificationService as unknown as NotificationService,
      userService as unknown as UserService,
      authService as unknown as AuthService,
    );
    jest.clearAllMocks();
    repository.save.mockResolvedValue(undefined);
    repository.findLatestByEmail.mockResolvedValue(null);
    repository.findLatestUnconsumedByEmail.mockResolvedValue(null);
    repository.incrementAttemptCount.mockResolvedValue(undefined);
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

      expect(repository.findLatestByEmail).toHaveBeenCalledWith({
        email: normalizedEmail,
        lock: true,
      });
      expect(repository.save).toHaveBeenCalledWith({ verification: expect.any(Object) });
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: normalizedEmail, subject: '[DDD] 지원자 이메일 인증번호' }),
      );
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

      expect(repository.incrementAttemptCount).toHaveBeenCalledWith({ id: verification.id });
      expect(repository.save).not.toHaveBeenCalled();
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
