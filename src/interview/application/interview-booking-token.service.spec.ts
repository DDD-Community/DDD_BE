import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/exception/app.exception';
import { InterviewBookingTokenService } from './interview-booking-token.service';

describe('InterviewBookingTokenService', () => {
  const jwtService = new JwtService({ secret: 'test-secret' });
  const service = new InterviewBookingTokenService(jwtService);
  const input = {
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    applicantName: '장원석',
    interviewEndDate: '2099-09-20',
  };

  it('발급한 토큰을 검증하면 payload 가 복원된다', () => {
    const token = service.issue(input);
    const payload = service.verify({ token });
    expect(payload).toMatchObject({
      purpose: 'interview_booking',
      applicationFormId: 123,
      cohortId: 12,
      cohortPartId: 52,
      partName: 'BE',
      applicantName: '장원석',
    });
  });

  it('interviewEndDate 가 있으면 그날 23:59:59 KST 로 만료를 설정한다', () => {
    const token = service.issue(input);
    const decoded = jwtService.decode<{ exp: number }>(token);
    const expectedMs = new Date('2099-09-20T23:59:59+09:00').getTime();
    // expiresIn(초) 계산 시 Date.now() 기반 반올림으로 1초 오차가 날 수 있다
    expect(Math.abs(decoded.exp * 1000 - expectedMs)).toBeLessThanOrEqual(1000);
  });

  it('interviewEndDate 가 null 이면 30일 뒤로 만료를 설정한다', () => {
    const token = service.issue({ ...input, interviewEndDate: null });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('interviewEndDate 가 과거면 30일 폴백을 쓴다', () => {
    const token = service.issue({ ...input, interviewEndDate: '2000-01-01' });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('날짜 형식이 아닌 interviewEndDate 는 30일 폴백을 쓴다', () => {
    const token = service.issue({ ...input, interviewEndDate: '미정' });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('형식은 맞지만 달력상 무효인 날짜(2099-02-30)는 30일 폴백을 쓴다', () => {
    const token = service.issue({ ...input, interviewEndDate: '2099-02-30' });
    const decoded = jwtService.decode<{ exp: number; iat: number }>(token);
    expect(decoded.exp - decoded.iat).toBe(30 * 24 * 60 * 60);
  });

  it('purpose 가 다른 토큰(지원자 세션 토큰)은 거부한다', () => {
    const sessionToken = jwtService.sign({ sub: 1, email: 'a@b.c', purpose: 'applicant' });
    expect(() => service.verify({ token: sessionToken })).toThrow(AppException);
  });

  it('서명이 다른 토큰은 거부한다', () => {
    const forged = new JwtService({ secret: 'other-secret' }).sign({
      purpose: 'interview_booking',
    });
    expect(() => service.verify({ token: forged })).toThrow(AppException);
  });

  it('만료된 토큰은 거부한다', () => {
    const expired = jwtService.sign(
      { purpose: 'interview_booking', applicationFormId: 123 },
      { expiresIn: -10 },
    );
    expect(() => service.verify({ token: expired })).toThrow(AppException);
  });
});
