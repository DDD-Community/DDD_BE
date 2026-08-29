import type { ExecutionContext } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { InterviewBookingGuard } from './interview-booking.guard';

describe('InterviewBookingGuard', () => {
  const tokenService = { verify: jest.fn() };
  const guard = new InterviewBookingGuard(tokenService as never);

  const makeContext = (authorization?: string) => {
    const request: Record<string, unknown> = { headers: { authorization } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { context, request };
  };

  beforeEach(() => jest.clearAllMocks());

  it('Bearer 토큰을 검증하고 payload 를 request 에 붙인다', () => {
    const payload = { purpose: 'interview_booking', applicationFormId: 123 };
    tokenService.verify.mockReturnValue(payload);
    const { context, request } = makeContext('Bearer valid-token');

    expect(guard.canActivate(context)).toBe(true);
    expect(tokenService.verify).toHaveBeenCalledWith({ token: 'valid-token' });
    expect(request.interviewBooking).toEqual(payload);
  });

  it('Authorization 헤더가 없으면 401', () => {
    const { context } = makeContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(AppException);
    expect(tokenService.verify).not.toHaveBeenCalled();
  });

  it('Bearer 형식이 아니면 401', () => {
    const { context } = makeContext('Basic abc');
    expect(() => guard.canActivate(context)).toThrow(AppException);
    expect(tokenService.verify).not.toHaveBeenCalled();
  });

  it('토큰 검증 실패는 그대로 전파한다', () => {
    tokenService.verify.mockImplementation(() => {
      throw new AppException('UNAUTHORIZED', 401);
    });
    const { context } = makeContext('Bearer bad-token');
    expect(() => guard.canActivate(context)).toThrow(AppException);
  });
});
