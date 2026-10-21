import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export type InterviewJoinTokenPayload = {
  purpose: 'interview_join';
  reservationId: number;
};

const DAY_SECONDS = 24 * 60 * 60;

@Injectable()
export class InterviewJoinTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  issue({ reservationId, slotEndAt }: { reservationId: number; slotEndAt: Date }): string {
    const expiresAt = slotEndAt.getTime() + 30 * DAY_SECONDS * 1000;
    const expiresIn = Math.max(DAY_SECONDS, Math.ceil((expiresAt - Date.now()) / 1000));
    const payload: InterviewJoinTokenPayload = { purpose: 'interview_join', reservationId };
    return this.jwtService.sign(payload, { expiresIn });
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

  createUrl({ reservationId, slotEndAt }: { reservationId: number; slotEndAt: Date }): string {
    const configured = this.configService.get<string>('INTERVIEW_JOIN_BASE_URL');
    const base = configured || this.defaultBaseUrl();
    const token = this.issue({ reservationId, slotEndAt });
    return `${base}?token=${encodeURIComponent(token)}`;
  }

  private defaultBaseUrl(): string {
    const callback = this.configService.getOrThrow<string>('GOOGLE_CALLBACK_URL');
    return `${new URL(callback).origin}/api/v1/interview-bookings/join`;
  }
}
