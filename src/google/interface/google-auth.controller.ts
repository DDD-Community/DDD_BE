import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { ApiResponse } from '../../common/response/api-response';
import type { GoogleAuthCallbackResult, GoogleProfile } from '../application/google.type';
import { GoogleAuthService } from '../application/google-auth.service';

@Controller({ path: 'auth', version: '1' })
export class GoogleAuthController {
  private readonly isProduction: boolean;
  private readonly clientRedirectUrl: string;

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.clientRedirectUrl = configService.getOrThrow<string>('CLIENT_REDIRECT_URL');
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @AuthUser() profile: GoogleProfile,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user } = await this.googleAuthService.googleLogin(profile);

    response.cookie('access_token', user.accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
    });

    // 로컬 테스트 환경에서는 바로 토큰을 복사할 수 있도록 화면에 JSON으로 띄워줍니다.
    if (!this.isProduction) {
      // NOTE: 디버그용 — 프로덕션에서는 실행되지 않음
      return ApiResponse.ok<GoogleAuthCallbackResult>({ accessToken: user.accessToken });
    }

    response.redirect(this.clientRedirectUrl);
  }
}
