import { ExecutionContext, HttpStatus } from '@nestjs/common';

import { AppException } from '../exception/app.exception';
import { OriginGuard } from './origin.guard';

const createContext = ({ method, origin }: { method: string; origin?: string }) =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ method, headers: origin ? { origin } : {} }),
    }),
  }) as unknown as ExecutionContext;

describe('OriginGuard', () => {
  const guard = new OriginGuard();

  it('허용된 오리진의 상태 변경 요청은 통과시킨다', () => {
    const context = createContext({ method: 'POST', origin: 'https://ddd-fe-web.vercel.app' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('허용되지 않은 오리진의 인증된 simple request 는 거부한다', () => {
    // multipart/form-data 는 preflight 가 없어 CORS 로는 전송을 막을 수 없다. SameSite=None 이라
    // 쿠키까지 실려 오므로 서버가 Origin 을 직접 보고 끊어야 한다.
    const context = createContext({ method: 'POST', origin: 'https://evil.example.com' });

    expect(() => guard.canActivate(context)).toThrow(AppException);

    try {
      guard.canActivate(context);
    } catch (error) {
      expect((error as AppException).getStatus()).toBe(HttpStatus.FORBIDDEN);
    }
  });

  it('예전 화이트리스트를 통과하던 제3자 Vercel 프로젝트 오리진을 거부한다', () => {
    // 이전 정규식 /^https:\/\/ddd-fe-web(-[\w-]+)?\.vercel\.app$/ 는 이 오리진을 허용했다.
    // Vercel 프로젝트 이름은 팀 단위로만 유일해서 제3자가 같은 이름을 쓸 수 있다.
    const context = createContext({
      method: 'POST',
      origin: 'https://ddd-fe-web-a1b2c3-attacker.vercel.app',
    });

    expect(() => guard.canActivate(context)).toThrow(AppException);
  });

  it('Origin 이 없는 요청은 브라우저가 만든 것이 아니므로 통과시킨다', () => {
    // 브라우저는 GET/HEAD 외 모든 요청에 Origin 을 강제로 붙인다. 없으면 서버 간 호출이나 curl 이고
    // 남의 쿠키를 실을 수 없어 CSRF 가 성립하지 않는다.
    const context = createContext({ method: 'POST' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('안전한 메서드는 오리진을 따지지 않는다', () => {
    const context = createContext({ method: 'GET', origin: 'https://evil.example.com' });

    expect(guard.canActivate(context)).toBe(true);
  });
});
