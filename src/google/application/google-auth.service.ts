import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { AuthService } from '../../auth/application/auth.service';
import { AppException } from '../../common/exception/app.exception';
import { UserService } from '../../user/application/user.service';
import { GoogleApiClient } from '../infrastructure/google-api.client';
import type { GoogleLoginResult, GoogleProfile, RefreshResult } from './google.type';

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly googleApiClient: GoogleApiClient,
  ) {}

  @Transactional()
  async googleLogin({
    email,
    firstName,
    lastName,
    sub,
    accessToken: googleAccessToken,
    refreshToken: googleRefreshToken,
  }: GoogleProfile): Promise<GoogleLoginResult> {
    if (!email) {
      throw new AppException('GOOGLE_AUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const { user, isNew } = await this.userService.register({
      email,
      firstName,
      lastName,
      sub,
      googleAccessToken,
      googleRefreshToken,
    });
    const accessToken = this.authService.signToken(user);
    const { token: refreshToken, hash } = this.authService.generateRefreshToken();
    const roles = (user.userRoles ?? []).map((userRole) => userRole.role);

    await this.userService.saveRefreshToken({ id: user.id, refreshToken: hash });

    return {
      user: {
        id: user.id,
        email: user.email,
        roles,
        accessToken,
        refreshToken,
      },
      isNew,
    };
  }

  async refresh({ refreshToken }: { refreshToken: string }): Promise<RefreshResult> {
    const hash = this.authService.hashRefreshToken({ token: refreshToken });
    const user = await this.userService.findByRefreshToken({ hash });

    if (!user) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const accessToken = this.authService.signToken(user);
    const { token: newRefreshToken, hash: newHash } = this.authService.generateRefreshToken();

    await this.userService.saveRefreshToken({ id: user.id, refreshToken: newHash });

    return { accessToken, refreshToken: newRefreshToken };
  }

  async logout({ userId }: { userId: number }) {
    await this.userService.saveRefreshToken({ id: userId, refreshToken: null });
  }

  // MEMO: @Transactional()을 의도적으로 제외합니다. (외부 API, 단일쿼리: 원자성 보장)
  async withdrawal({ userId }: { userId: number }) {
    const user = await this.userService.findById({ id: userId });
    if (!user) {
      throw new AppException('USER_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const revokeToken = user.googleRefreshToken || user.googleAccessToken;
    if (revokeToken) {
      try {
        await this.googleApiClient.revokeToken({ token: revokeToken });
      } catch (error) {
        // MEMO: 구글 서버와의 통신 실패 시에도 자체 회원의 논리적 탈퇴(Soft Delete)는 계속 진행합니다.
        this.logger.warn(
          `Google token revoke failed for userId=${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    await this.userService.saveRefreshToken({ id: userId, refreshToken: null });
    await this.userService.withdraw({ id: userId });
  }
}
