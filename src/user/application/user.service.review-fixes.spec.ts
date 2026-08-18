import { AuditLogService } from '../../audit/application/audit-log.service';
import { UserRepository } from '../domain/user.repository';
import { UserService } from './user.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
}));

describe('UserService review fixes', () => {
  it('지원자 인증은 탈퇴 계정을 복구하지 않는다', async () => {
    const repository = {
      findByEmail: jest.fn().mockResolvedValue({ id: 1, deletedAt: new Date() }),
      restore: jest.fn(),
    };
    const service = new UserService(repository as unknown as UserRepository, {} as AuditLogService);

    await expect(
      service.register({
        email: 'applicant@example.com',
        firstName: 'applicant',
        sub: 'applicant:applicant@example.com',
        restoreDeleted: false,
      }),
    ).rejects.toMatchObject({ errorCode: 'WITHDRAWN_ACCOUNT' });
    expect(repository.restore).not.toHaveBeenCalled();
  });

  it('동시 unique 위반은 기존 사용자를 반환한다', async () => {
    const existingUser = { id: 1, deletedAt: null };
    const repository = {
      findByEmail: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(existingUser),
      register: jest.fn().mockRejectedValue({ code: '23505' }),
    };
    const service = new UserService(repository as unknown as UserRepository, {} as AuditLogService);

    await expect(
      service.register({ email: 'applicant@example.com', firstName: 'applicant', sub: 'sub' }),
    ).resolves.toEqual({ user: existingUser, isNew: false });
  });
});
