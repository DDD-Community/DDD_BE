import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

const NONCE_COOKIE = 'gcal_connect_nonce';

@Catch()
@Injectable()
export class GoogleCalendarCallbackRedirectFilter implements ExceptionFilter {
  private readonly redirectUrl: string;
  private readonly secure: boolean;

  constructor(configService: ConfigService) {
    this.redirectUrl = configService.getOrThrow<string>('CLIENT_REDIRECT_URL');
    this.secure = configService.get<string>('NODE_ENV') === 'production';
  }

  catch(_exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    // Guard 또는 입력 검증이 컨트롤러 전에 실패해도 브라우저 콜백은 항상 프론트로 돌아간다.
    response.clearCookie(NONCE_COOKIE, {
      httpOnly: true,
      secure: this.secure,
      sameSite: 'lax',
      path: '/api/v1/admin/google-calendar',
    });
    const redirectUrl = new URL(this.redirectUrl);
    redirectUrl.searchParams.set('calendar', 'error');
    redirectUrl.searchParams.set('reason', 'invalid_state');
    response.redirect(HttpStatus.FOUND, redirectUrl.toString());
  }
}
