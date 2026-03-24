import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Cookie } from '../../common/decorator/cookie.decorator';
import { AppException } from '../../common/exception/app.exception';
import { ApiResponse } from '../../common/response/api-response';
import type {
  GoogleAuthCallbackResult,
  GoogleProfile,
  GoogleRefreshResult,
  RefreshResult,
} from '../application/google.type';
import { GoogleAuthService } from '../application/google-auth.service';

const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

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
  ): Promise<ApiResponse<GoogleAuthCallbackResult> | void> {
    const { user } = await this.googleAuthService.googleLogin(profile);

    this.setAuthCookies({
      response,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    });

    // 로컬 테스트 환경에서는 바로 토큰을 복사할 수 있도록 화면에 JSON으로 띄워줍니다.
    if (!this.isProduction) {
      // NOTE: 디버그용 — 프로덕션에서는 실행되지 않음
      return ApiResponse.ok<GoogleAuthCallbackResult>({ accessToken: user.accessToken });
    }

    response.redirect(this.clientRedirectUrl);
  }

  @Post('refresh')
  async refreshToken(
    @Cookie('refresh_token') refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ApiResponse<GoogleRefreshResult>> {
    if (!refreshToken) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }

    const result: RefreshResult = await this.googleAuthService.refresh({ refreshToken });

    this.setAuthCookies({
      response,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    });

    // NOTE: refreshToken은 httpOnly 쿠키로만 전달 — 응답 body에 포함하지 않음
    return ApiResponse.ok<GoogleRefreshResult>({ accessToken: result.accessToken });
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async logout(
    @AuthUser() jwtUser: JwtUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.googleAuthService.logout({ userId: jwtUser.id });

    response.clearCookie('access_token');
    response.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  @Delete('withdrawal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async withdrawal(
    @AuthUser() jwtUser: JwtUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.googleAuthService.withdrawal({ userId: jwtUser.id });

    response.clearCookie('access_token');
    response.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  private setAuthCookies({
    response,
    accessToken,
    refreshToken,
  }: {
    response: Response;
    accessToken: string;
    refreshToken: string;
  }): void {
    const baseOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: 'lax' as const,
    };

    response.cookie('access_token', accessToken, {
      ...baseOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    response.cookie('refresh_token', refreshToken, {
      ...baseOptions,
      path: '/api/v1/auth/refresh',
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }
}
