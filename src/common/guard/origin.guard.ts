import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';

import { isAllowedOrigin } from '../../config/cors.config';
import { AppException } from '../exception/app.exception';

// 인증 쿠키를 SameSite=None 으로 바꾸면서 Lax 가 덤으로 막아주던 CSRF 방어가 사라진다.
// CORS 는 simple request(multipart 업로드, 폼 POST)의 "전송" 자체는 막지 못하고 응답 판독만
// 막으므로, 상태를 바꾸는 요청은 서버가 Origin 을 직접 검증한다.
//
// 브라우저는 GET/HEAD 외의 모든 요청에 Origin 을 강제로 붙인다. 따라서 Origin 이 없는 요청은
// 브라우저가 만든 것이 아니고(서버 간 호출, curl, 웹훅) 남의 쿠키를 실을 수도 없으므로 통과시킨다.
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();

    if (SAFE_METHODS.has(request.method)) {
      return true;
    }

    const origin = request.headers.origin;

    if (!origin) {
      return true;
    }

    if (!isAllowedOrigin({ origin })) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
