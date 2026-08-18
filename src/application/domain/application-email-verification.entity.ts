import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';

@Entity('application_email_verifications')
@Index('idx_application_email_verifications_email_created_at', ['email', 'createdAt'])
export class ApplicationEmailVerification extends BaseEntity {
  @Column()
  email: string;

  @Column()
  codeHash: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ default: 0 })
  attemptCount: number;

  @Column({ type: 'timestamptz', nullable: true })
  consumedAt: Date | null;

  static create({
    email,
    codeHash,
    expiresAt,
  }: {
    email: string;
    codeHash: string;
    expiresAt: Date;
  }): ApplicationEmailVerification {
    const verification = new ApplicationEmailVerification();
    verification.email = email;
    verification.codeHash = codeHash;
    verification.expiresAt = expiresAt;
    verification.attemptCount = 0;
    verification.consumedAt = null;
    return verification;
  }

  incrementAttempt(): void {
    this.attemptCount += 1;
  }

  consume(): void {
    this.consumedAt = new Date();
  }
}
