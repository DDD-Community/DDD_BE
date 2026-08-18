import { ApplicationEmailVerification } from './application-email-verification.entity';

export abstract class ApplicationEmailVerificationRepository {
  abstract acquireEmailLock({ email }: { email: string }): Promise<void>;

  abstract save({
    verification,
  }: {
    verification: ApplicationEmailVerification;
  }): Promise<ApplicationEmailVerification>;

  abstract findLatestByEmail({
    email,
    lock,
  }: {
    email: string;
    lock?: boolean;
  }): Promise<ApplicationEmailVerification | null>;

  abstract findLatestUnconsumedByEmail({
    email,
    lock,
  }: {
    email: string;
    lock?: boolean;
  }): Promise<ApplicationEmailVerification | null>;

  abstract consumeAllUnconsumedByEmail({ email }: { email: string }): Promise<void>;

  abstract deleteConsumedOrExpiredBefore({ cutoffDate }: { cutoffDate: Date }): Promise<number>;
}
