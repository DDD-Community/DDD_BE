import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { NotificationService } from '../../notification/application/notification.service';
import { escapeHtml } from '../../notification/util/build-email';
import { InterviewRepository } from '../domain/interview.repository';
import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';
import { InterviewJoinTokenService } from './interview-join-token.service';

export type InterviewJoinResult =
  | { kind: 'invalid' | 'cancelled' | 'ended' | 'unavailable' }
  | { kind: 'too_early'; opensAt: Date; startAt: Date }
  | { kind: 'redirect'; url: string }
  | { kind: 'info'; location: string };

@Injectable()
export class InterviewJoinService {
  private readonly logger = new Logger(InterviewJoinService.name);
  private readonly alertedSlotIds = new Set<number>();

  constructor(
    private readonly tokenService: InterviewJoinTokenService,
    private readonly interviewRepository: InterviewRepository,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  async resolveJoin({ token, now }: { token: string; now: Date }): Promise<InterviewJoinResult> {
    const payload = this.tokenService.verify({ token });
    if (!payload) {
      return { kind: 'invalid' };
    }

    const reservation = await this.interviewRepository.findReservationByIdIncludingDeleted({
      id: payload.reservationId,
    });
    if (!reservation || reservation.deletedAt || !reservation.slot || reservation.slot.deletedAt) {
      return { kind: 'cancelled' };
    }

    const slot = reservation.slot;
    if (now >= slot.endAt) {
      return { kind: 'ended' };
    }
    const opensAt = new Date(slot.startAt.getTime() - 10 * 60 * 1000);
    if (now < opensAt) {
      return { kind: 'too_early', opensAt, startAt: slot.startAt };
    }

    if (slot.meetingStatus !== InterviewSlotMeetingStatus.NONE && slot.meetingStatus) {
      if (this.isMeetUrl(slot.meetUrl)) {
        return { kind: 'redirect', url: slot.meetUrl! };
      }
      await this.alertUnavailable({ slotId: slot.id });
      return { kind: 'unavailable' };
    }

    const location = slot.location.trim();
    if (this.isHttpUrl(location)) {
      return { kind: 'redirect', url: location };
    }
    return { kind: 'info', location };
  }

  private isHttpUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private isMeetUrl(value: string | null): boolean {
    if (!value) {
      return false;
    }
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && url.hostname === 'meet.google.com';
    } catch {
      return false;
    }
  }

  private async alertUnavailable({ slotId }: { slotId: number }): Promise<void> {
    if (this.alertedSlotIds.has(slotId)) {
      return;
    }
    this.alertedSlotIds.add(slotId);
    const to = this.configService.get<string>('OPS_ALERT_EMAIL');
    if (!to) {
      this.logger.warn(`면접 입장 링크 사용 불가 (slotId=${slotId}, reason=invalid_meet_url)`);
      return;
    }
    const text = `슬롯 ID: ${slotId}\n사유: invalid_meet_url`;
    try {
      await this.notificationService.sendEmail({
        to,
        subject: '[DDD][경고] 면접 입장 링크 사용 불가',
        html: `<pre>${escapeHtml(text)}</pre>`,
        text,
      });
    } catch {
      this.logger.warn(`면접 입장 링크 운영 알림 발송 실패 (slotId=${slotId})`);
    }
  }
}
