import { DataSource, Repository } from 'typeorm';

import { ApplicationEmailVerification } from '../domain/application-email-verification.entity';
import { ApplicationEmailVerificationWriteRepository } from './application-email-verification.write.repository';

describe('ApplicationEmailVerificationWriteRepository', () => {
  it('normalized email을 transaction-scoped advisory lock의 parameter로 전달한다', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const typeormRepository = {
      manager: { query },
    } as unknown as Repository<ApplicationEmailVerification>;
    const dataSource = {
      getRepository: jest.fn().mockReturnValue(typeormRepository),
    } as unknown as DataSource;
    const repository = new ApplicationEmailVerificationWriteRepository(dataSource);

    await repository.acquireEmailLock({ email: 'applicant@example.com' });

    expect(query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [
      'applicant@example.com',
    ]);
  });
});
