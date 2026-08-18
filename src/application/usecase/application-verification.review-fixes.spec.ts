import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';

import { AuthService } from '../../auth/application/auth.service';
import { NotificationService } from '../../notification/application/notification.service';
import { UserService } from '../../user/application/user.service';
import { ApplicationEmailVerificationRepository } from '../domain/application-email-verification.repository';
import { ApplicationVerificationService } from './application-verification.service';

describe('ApplicationVerificationService review fixes', () => {
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

  it('메일 발송 실패에도 인증 요청은 204 계약을 유지한다', async () => {
    const repository = {
      findLatestByEmail: jest.fn().mockResolvedValue(null),
      consumeAllUnconsumedByEmail: jest.fn().mockResolvedValue(undefined),
      save: jest.fn().mockResolvedValue(undefined),
    };
    const notificationService = { sendEmail: jest.fn().mockRejectedValue(new Error('SMTP 실패')) };
    const service = new ApplicationVerificationService(
      repository as unknown as ApplicationEmailVerificationRepository,
      notificationService as unknown as NotificationService,
      {} as UserService,
      {} as AuthService,
    );

    await expect(service.requestCode({ email: 'applicant@example.com' })).resolves.toBeUndefined();
    expect(repository.save).toHaveBeenCalledTimes(1);
  });
});
