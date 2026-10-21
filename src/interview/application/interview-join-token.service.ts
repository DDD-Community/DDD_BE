import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type InterviewJoinTokenPayload = {
  purpose: 'interview_join';
  reservationId: number;
};

// 만료를 슬롯 시각에 묶지 않는다. 면접을 한참 뒤로 미뤄도 이미 보낸 메일 링크가 살아 있어야 하고,
// 입장 가능 여부는 누를 때마다 DB 의 현재 슬롯 시각으로 다시 판정한다.
const TOKEN_LIFETIME_SECONDS = 180 * 24 * 60 * 60;

@Injectable()
export class InterviewJoinTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issue({ reservationId }: { reservationId: number }): string {
    const payload: InterviewJoinTokenPayload = { purpose: 'interview_join', reservationId };
    return this.jwtService.sign(payload, { expiresIn: TOKEN_LIFETIME_SECONDS });
  }

  verify({ token }: { token: string }): InterviewJoinTokenPayload | null {
    try {
      const payload = this.jwtService.verify<InterviewJoinTokenPayload>(token);
      if (
        payload.purpose !== 'interview_join' ||
        !Number.isSafeInteger(payload.reservationId) ||
        payload.reservationId <= 0
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  createUrl({ reservationId }: { reservationId: number }): string {
    const configured = this.configService.get<string>('INTERVIEW_JOIN_BASE_URL');
    // 설정값에 쿼리나 fragment 가 있어도 token 이 쿼리 매개변수로 들어가도록 문자열로 잇지 않는다.
    const url = new URL(configured || this.defaultBaseUrl());
    url.searchParams.set('token', this.issue({ reservationId }));
    return url.toString();
  }

  private defaultBaseUrl(): string {
    const callback = this.configService.getOrThrow<string>('GOOGLE_CALLBACK_URL');
    return `${new URL(callback).origin}/api/v1/interview-bookings/join`;
  }
}
