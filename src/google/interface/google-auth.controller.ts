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
import type { CookieOptions, Response } from 'express';

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
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth/refresh';

@ApiTags('Auth')
@ApiExtraModels(GoogleAuthCallbackResponseDto, GoogleRefreshResponseDto)
@Controller({ path: 'auth', version: '1' })
export class GoogleAuthController {
  private readonly isProduction: boolean;
  private readonly clientRedirectUrl: string;
  private readonly cookieBaseOptions: CookieOptions;

  constructor(
    private readonly googleAuthService: GoogleAuthService,
    configService: ConfigService,
  ) {
    this.isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.clientRedirectUrl = configService.getOrThrow<string>('CLIENT_REDIRECT_URL');

    // 지원자 프론트(ddd-fe-web.vercel.app)와 API(admin.dddstudy.kr)는 등록 도메인이 서로 달라
    // cross-site 다. Lax 로는 fetch/XHR 에 쿠키가 실리지 않아 임시저장·제출은 물론 401 이후의
    // /auth/refresh 재발급까지 전부 막힌다. None 은 Secure 가 전제라 운영에서만 쓰고,
    // 로컬은 localhost 끼리 same-site 라 Lax 를 유지한다(Secure 없이 None 을 쓰면 브라우저가 거부).
    //
    // 발급과 삭제가 반드시 같은 값을 쓰도록 한곳에 둔다. clearCookie 는 옵션을 넘기지 않으면
    // sameSite 도 secure 도 붙이지 않는데, 속성 없는 삭제용 Set-Cookie 는 cross-site 응답에서
    // 브라우저가 거부한다. 그러면 서버는 204 를 주는데 브라우저에는 쿠키가 남아 로그아웃이
    // 무효가 된다(JWT 는 stateless 라 최대 24시간 유효).
    this.cookieBaseOptions = {
      httpOnly: true,
      secure: this.isProduction,
      sameSite: this.isProduction ? 'none' : 'lax',
    };
  }

  @ApiDoc({
    summary: 'Google OAuth 로그인 시작',
    description: 'Google 로그인 페이지로 리다이렉트됩니다.',
    operationId: 'auth_getGoogleLoginUrl',
  })
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @ApiDoc({
    summary: 'Google OAuth 콜백',
    description: '로그인 성공 시 access_token · refresh_token 쿠키가 발급됩니다.',
    operationId: 'auth_googleLoginCallback',
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
    operationId: 'auth_refreshAuthToken',
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
    operationId: 'auth_logout',
    auth: true,
    responses: [GoogleAuthSwagger.logout.noContent, GoogleAuthSwagger.logout.unauthorized],
  })
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(AuthGuard('jwt'))
  async logout(@AuthUser() jwtUser: JwtUser, @Res({ passthrough: true }) response: Response) {
    await this.googleAuthService.logout({ userId: jwtUser.id });

    this.clearAuthCookies({ response });
  }

  @ApiDoc({
    summary: '회원 탈퇴',
    description: 'Google 토큰 revoke 후 계정을 소프트 삭제합니다.',
    operationId: 'auth_deleteWithdrawal',
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

    this.clearAuthCookies({ response });
  }

  // 삭제용 Set-Cookie 도 발급 때와 같은 속성으로 나가야 브라우저가 받아준다.
  private clearAuthCookies({ response }: { response: Response }): void {
    response.clearCookie('access_token', this.cookieBaseOptions);
    response.clearCookie('refresh_token', {
      ...this.cookieBaseOptions,
      path: REFRESH_TOKEN_COOKIE_PATH,
    });
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
    response.cookie('access_token', accessToken, {
      ...this.cookieBaseOptions,
      maxAge: ACCESS_TOKEN_MAX_AGE_MS,
    });
    response.cookie('refresh_token', refreshToken, {
      ...this.cookieBaseOptions,
      path: REFRESH_TOKEN_COOKIE_PATH,
      maxAge: REFRESH_TOKEN_MAX_AGE_MS,
    });
  }
}
