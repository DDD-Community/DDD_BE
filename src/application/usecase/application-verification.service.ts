import { createHash, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AppException } from '../../common/exception/app.exception';
import { NotificationService } from '../../notification/application/notification.service';
import { UserService } from '../../user/application/user.service';
import { ApplicationEmailVerification } from '../domain/application-email-verification.entity';
import { ApplicationEmailVerificationRepository } from '../domain/application-email-verification.repository';

const VERIFICATION_CODE_EXPIRES_IN_MS = 10 * 60 * 1000;
const VERIFICATION_CODE_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ApplicationVerificationService {
  constructor(
    private readonly verificationRepository: ApplicationEmailVerificationRepository,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
  ) {}

  @Transactional()
  async requestCode({ email }: { email: string }): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const latest = await this.verificationRepository.findLatestByEmail({ email: normalizedEmail });
    const now = Date.now();

    if (latest && now - latest.createdAt.getTime() < VERIFICATION_CODE_COOLDOWN_MS) {
      throw new AppException('VERIFICATION_COOLDOWN', HttpStatus.TOO_MANY_REQUESTS);
    }

    const previous = await this.verificationRepository.findLatestUnconsumedByEmail({
      email: normalizedEmail,
    });
    if (previous) {
      previous.consume();
      await this.verificationRepository.save({ verification: previous });
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const verification = ApplicationEmailVerification.create({
      email: normalizedEmail,
      codeHash: this.hashCode({ code }),
      expiresAt: new Date(now + VERIFICATION_CODE_EXPIRES_IN_MS),
    });
    await this.verificationRepository.save({ verification });

    await this.notificationService.sendEmail({
      to: normalizedEmail,
      subject: '[DDD] 지원자 이메일 인증번호',
      html: `<p>지원자 인증번호는 <strong>${code}</strong>입니다.</p><p>인증번호는 10분 동안 유효합니다.</p>`,
      text: `지원자 인증번호는 ${code}입니다. 인증번호는 10분 동안 유효합니다.`,
    });
  }

  @Transactional()
  async confirmCode({ email, code }: { email: string; code: string }) {
    const normalizedEmail = this.normalizeEmail(email);
    const verification = await this.verificationRepository.findLatestUnconsumedByEmail({
      email: normalizedEmail,
      lock: true,
    });

    if (!verification || verification.expiresAt.getTime() <= Date.now()) {
      throw new AppException('VERIFICATION_CODE_EXPIRED', HttpStatus.BAD_REQUEST);
    }
    if (verification.attemptCount >= MAX_ATTEMPTS) {
      throw new AppException('VERIFICATION_CODE_EXPIRED', HttpStatus.BAD_REQUEST);
    }

    const isValid = this.isCodeValid({ verification, code });
    if (!isValid) {
      verification.incrementAttempt();
      await this.verificationRepository.save({ verification });
      throw new AppException('VERIFICATION_CODE_INVALID', HttpStatus.BAD_REQUEST);
    }

    verification.consume();
    await this.verificationRepository.save({ verification });

    const localPart = normalizedEmail.split('@')[0];
    const { user } = await this.userService.register({
      email: normalizedEmail,
      firstName: localPart,
      sub: `applicant:${normalizedEmail}`,
    });

    return { userId: user.id, email: normalizedEmail };
  }

  private isCodeValid({
    verification,
    code,
  }: {
    verification: ApplicationEmailVerification;
    code: string;
  }): boolean {
    const expected = Buffer.from(verification.codeHash, 'utf8');
    const actual = Buffer.from(this.hashCode({ code }), 'utf8');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  private hashCode({ code }: { code: string }): string {
    return createHash('sha256').update(code).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
