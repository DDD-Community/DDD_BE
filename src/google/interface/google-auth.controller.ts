import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import { AuthUser } from '../../common/decorator/auth-user.decorator';
import type { GoogleProfile } from '../application/google.type';
import { GoogleAuthService } from '../application/google-auth.service';

@Controller('v1/auth')
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user } = await this.googleAuthService.googleLogin(profile);

    res.cookie('access_token', user.accessToken, {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax',
    });

    // 로컬 테스트 환경에서는 바로 토큰을 복사할 수 있도록 화면에 JSON으로 띄워줍니다.
    if (!this.isProduction) {
      return {
        message: '로그인 성공! 아래 access_token을 복사해서 Postman에 붙여넣으세요.',
        access_token: user.accessToken,
      };
    }

    res.redirect(this.clientRedirectUrl);
  }
}
