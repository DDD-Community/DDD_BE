import { HttpStatus } from '@nestjs/common';

import { AppException } from '../exception/app.exception';
import { RejectApplicantSessionGuard } from './reject-applicant-session.guard';

const context = (user?: { purpose?: 'applicant' }) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as never;

describe('RejectApplicantSessionGuard', () => {
  it('지원자 세션을 일반 인증 API에서 거부한다', () => {
    expect(() =>
      new RejectApplicantSessionGuard().canActivate(context({ purpose: 'applicant' })),
    ).toThrow(new AppException('APPLICANT_SESSION_NOT_ALLOWED', HttpStatus.FORBIDDEN));
  });

  it('일반 세션은 통과시킨다', () => {
    expect(new RejectApplicantSessionGuard().canActivate(context())).toBe(true);
  });
});
