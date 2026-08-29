import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { AppException } from '../../common/exception/app.exception';

export type InterviewBookingTokenPayload = {
  purpose: 'interview_booking';
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
  applicantName: string;
};

const BOOKING_TOKEN_PURPOSE = 'interview_booking' as const;
const FALLBACK_EXPIRES_IN_SECONDS = 30 * 24 * 60 * 60;

@Injectable()
export class InterviewBookingTokenService {
  constructor(private readonly jwtService: JwtService) {}

  issue({
    applicationFormId,
    cohortId,
    cohortPartId,
    partName,
    applicantName,
    interviewEndDate,
  }: {
    applicationFormId: number;
    cohortId: number;
    cohortPartId: number;
    partName: string;
    applicantName: string;
    interviewEndDate: string | null;
  }): string {
    const payload: InterviewBookingTokenPayload = {
      purpose: BOOKING_TOKEN_PURPOSE,
      applicationFormId,
      cohortId,
      cohortPartId,
      partName,
      applicantName,
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.resolveExpiresInSeconds(interviewEndDate),
    });
  }

  verify({ token }: { token: string }): InterviewBookingTokenPayload {
    let payload: InterviewBookingTokenPayload;
    try {
      payload = this.jwtService.verify<InterviewBookingTokenPayload>(token);
    } catch {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    if (payload.purpose !== BOOKING_TOKEN_PURPOSE) {
      throw new AppException('UNAUTHORIZED', HttpStatus.UNAUTHORIZED);
    }
    return payload;
  }

  // 면접 종료일 23:59:59 KST 까지. 값이 없거나 과거·파싱 불가면 30일 폴백.
  private resolveExpiresInSeconds(interviewEndDate: string | null): number {
    if (!interviewEndDate || !/^\d{4}-\d{2}-\d{2}$/.test(interviewEndDate)) {
      return FALLBACK_EXPIRES_IN_SECONDS;
    }
    const expiresAt = new Date(`${interviewEndDate}T23:59:59+09:00`);
    if (Number.isNaN(expiresAt.getTime())) {
      return FALLBACK_EXPIRES_IN_SECONDS;
    }
    const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    return seconds > 0 ? seconds : FALLBACK_EXPIRES_IN_SECONDS;
  }
}
