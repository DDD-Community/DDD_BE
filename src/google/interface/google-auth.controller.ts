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
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Cookie } from '../../common/decorator/cookie.decorator';
import { AppException } from '../../common/exception/app.exception';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import type {
  GoogleAuthCallbackResult,
  GoogleProfile,
  GoogleRefreshResult,
  RefreshResult,
} from '../application/google.type';
import { GoogleAuthService } from '../application/google-auth.service';
import { GoogleAuthCallbackResponseDto, GoogleRefreshResponseDto } from './dto/google-auth.dto';
import { GoogleAuthSwagger } from './google-auth.swagger';

const ACCESS_TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@ApiTags('Auth')
@ApiExtraModels(GoogleAuthCallbackResponseDto, GoogleRefreshResponseDto)
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

  @ApiDoc({
    summary: 'Google OAuth 로그인 시작',
    description: 'Google 로그인 페이지로 리다이렉트됩니다.',
  })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @ApiDoc({
    summary: 'Google OAuth 콜백',
    description: '로그인 성공 시 access_token · refresh_token 쿠키가 발급됩니다.',
    responses: [GoogleAuthSwagger.googleCallback.success],
  })
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(
    @AuthUser() profile: GoogleProfile,
    @Res({ passthrough: true }) response: Response,
  ) {
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

  @ApiDoc({
    summary: 'Access Token 재발급',
    description: 'refresh_token 쿠키를 사용해 새 토큰을 발급합니다. 두 쿠키 모두 갱신됩니다.',
    responses: [GoogleAuthSwagger.refresh.success, GoogleAuthSwagger.refresh.unauthorized],
  })
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshToken(
    @Cookie('refresh_token') refreshToken: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ) {
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

  @ApiDoc({
    summary: '로그아웃',
    description: 'access_token · refresh_token 쿠키를 삭제합니다.',
    auth: true,
    responses: [GoogleAuthSwagger.logout.noContent, GoogleAuthSwagger.logout.unauthorized],
  })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async logout(@AuthUser() jwtUser: JwtUser, @Res({ passthrough: true }) response: Response) {
    await this.googleAuthService.logout({ userId: jwtUser.id });

    response.clearCookie('access_token');
    response.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' });
  }

  @ApiDoc({
    summary: '회원 탈퇴',
    description: 'Google 토큰 revoke 후 계정을 소프트 삭제합니다.',
    auth: true,
    responses: [
      GoogleAuthSwagger.withdrawal.noContent,
      GoogleAuthSwagger.withdrawal.unauthorized,
      GoogleAuthSwagger.withdrawal.notFound,
    ],
  })
  @Delete('withdrawal')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async withdrawal(@AuthUser() jwtUser: JwtUser, @Res({ passthrough: true }) response: Response) {
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
