import { createHash, createHmac, randomInt, timingSafeEqual } from 'node:crypto';

import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transactional } from 'typeorm-transactional';

import { AuthService } from '../../auth/application/auth.service';
import { AppException } from '../../common/exception/app.exception';
import { maskEmail } from '../../common/util/mask-email';
import { NotificationService } from '../../notification/application/notification.service';
import { UserService } from '../../user/application/user.service';
import { ApplicationEmailVerification } from '../domain/application-email-verification.entity';
import { ApplicationEmailVerificationRepository } from '../domain/application-email-verification.repository';

const VERIFICATION_CODE_EXPIRES_IN_MS = 10 * 60 * 1000;
const VERIFICATION_CODE_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class ApplicationVerificationService {
  private readonly logger = new Logger(ApplicationVerificationService.name);
  private readonly verificationHashKey: Buffer;

  constructor(
    private readonly verificationRepository: ApplicationEmailVerificationRepository,
    private readonly notificationService: NotificationService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    // 6자리 코드는 평문 SHA-256만으로 DB가 유출되면 전수 대입이 가능하므로, JWT_SECRET을 직접 재사용하지 않고 용도를 분리해 키를 만든다.
    this.verificationHashKey = createHash('sha256')
      .update(`applicant-verification:${configService.getOrThrow<string>('JWT_SECRET')}`)
      .digest();
  }

  async requestCode({ email }: { email: string }): Promise<void> {
    const normalizedEmail = this.normalizeEmail(email);
    const { code } = await this.createVerification({ email: normalizedEmail });

    try {
      await this.notificationService.sendEmail({
        to: normalizedEmail,
        subject: '[DDD] 지원자 이메일 인증번호',
        html: `<p>지원자 인증번호는 <strong>${code}</strong>입니다.</p><p>인증번호는 10분 동안 유효합니다.</p>`,
        text: `지원자 인증번호는 ${code}입니다. 인증번호는 10분 동안 유효합니다.`,
      });
    } catch {
      this.logger.error(`인증 메일 발송 실패: to=${maskEmail({ email: normalizedEmail })}`);
    }
  }

  @Transactional()
  private async createVerification({ email }: { email: string }): Promise<{ code: string }> {
    await this.verificationRepository.acquireEmailLock({ email });
    const latest = await this.verificationRepository.findLatestByEmail({ email, lock: true });
    const now = Date.now();

    if (latest && now - latest.createdAt.getTime() < VERIFICATION_CODE_COOLDOWN_MS) {
      throw new AppException('VERIFICATION_COOLDOWN', HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.verificationRepository.consumeAllUnconsumedByEmail({ email });

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const verification = ApplicationEmailVerification.create({
      email,
      codeHash: this.hashCode({ code }),
      expiresAt: new Date(now + VERIFICATION_CODE_EXPIRES_IN_MS),
    });
    await this.verificationRepository.save({ verification });

    return { code };
  }

  async confirmCode({ email, code }: { email: string; code: string }) {
    const result = await this.confirmCodeInTransaction({ email, code });
    if (result.kind === 'invalid') {
      throw new AppException('VERIFICATION_CODE_INVALID', HttpStatus.BAD_REQUEST);
    }
    return { accessToken: result.accessToken, email: result.email };
  }

  @Transactional()
  private async confirmCodeInTransaction({ email, code }: { email: string; code: string }) {
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

    if (!this.isCodeValid({ verification, code })) {
      // 행 잠금 아래에서 시도 횟수를 저장해야 동시 요청도 제한을 넘길 수 없다. throw가 아닌 return이므로 트랜잭션이 커밋된다.
      verification.incrementAttempt();
      await this.verificationRepository.save({ verification });
      return { kind: 'invalid' as const };
    }

    verification.consume();
    await this.verificationRepository.save({ verification });

    const localPart = normalizedEmail.split('@')[0];
    const { user } = await this.userService.register({
      email: normalizedEmail,
      firstName: localPart,
      sub: `applicant:${normalizedEmail}`,
      restoreDeleted: false,
    });

    return {
      kind: 'success' as const,
      accessToken: this.authService.signApplicantToken({ id: user.id, email: normalizedEmail }),
      email: normalizedEmail,
    };
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
    return createHmac('sha256', this.verificationHashKey).update(code).digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
