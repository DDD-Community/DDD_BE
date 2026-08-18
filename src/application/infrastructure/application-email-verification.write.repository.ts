import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { ApplicationEmailVerification } from '../domain/application-email-verification.entity';
import { ApplicationEmailVerificationRepository } from '../domain/application-email-verification.repository';

@Injectable()
export class ApplicationEmailVerificationWriteRepository extends ApplicationEmailVerificationRepository {
  private readonly repository: Repository<ApplicationEmailVerification>;

  constructor(dataSource: DataSource) {
    super();
    this.repository = dataSource.getRepository(ApplicationEmailVerification);
  }

  async save({ verification }: { verification: ApplicationEmailVerification }) {
    return this.repository.save(verification);
  }

  async findLatestByEmail({ email, lock = false }: { email: string; lock?: boolean }) {
    const queryBuilder = this.repository
      .createQueryBuilder('verification')
      .where('verification.email = :email', { email })
      .orderBy('verification.createdAt', 'DESC')
      .take(1);

    if (lock) {
      queryBuilder.setLock('pessimistic_write');
    }

    return queryBuilder.getOne();
  }

  async findLatestUnconsumedByEmail({ email, lock = false }: { email: string; lock?: boolean }) {
    const queryBuilder = this.repository
      .createQueryBuilder('verification')
      .where('verification.email = :email', { email })
      .andWhere('verification.consumedAt IS NULL')
      .orderBy('verification.createdAt', 'DESC')
      .take(1);

    if (lock) {
      queryBuilder.setLock('pessimistic_write');
    }

    return queryBuilder.getOne();
  }

  async incrementAttemptCount({ id }: { id: number }): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(ApplicationEmailVerification)
      .set({ attemptCount: () => '"attemptCount" + 1' })
      .where('id = :id', { id })
      .execute();
  }

  async consumeAllUnconsumedByEmail({ email }: { email: string }): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(ApplicationEmailVerification)
      .set({ consumedAt: () => 'now()' })
      .where('email = :email', { email })
      .andWhere('"consumedAt" IS NULL')
      .execute();
  }

  async deleteConsumedOrExpiredBefore({ cutoffDate }: { cutoffDate: Date }): Promise<number> {
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from(ApplicationEmailVerification)
      .where('"createdAt" < :cutoffDate', { cutoffDate })
      .andWhere('("consumedAt" IS NOT NULL OR "expiresAt" < :cutoffDate)', { cutoffDate })
      .execute();

    return result.affected ?? 0;
  }
}
