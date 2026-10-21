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
      if (!this.isMeetUrl(slot.meetUrl)) {
        await this.alertUnavailable({ slotId: slot.id, reason: 'invalid_meet_url' });
        return { kind: 'unavailable' };
      }
      // 상태값(OUT_OF_SYNC)만으로는 막지 않는다. 시간·설명 수정만 실패했다면 회의는 그대로 맞다.
      // 주인 교체가 실패한 경우에만 meetUrl 이 옛 주인의 회의라, 지금 면접관이 없는 방으로 보내게 된다.
      const host = slot.interviewers?.find((interviewer) => interviewer.isHost);
      if (!host || slot.calendarOwnerUserId !== host.userId) {
        await this.alertUnavailable({ slotId: slot.id, reason: 'host_mismatch' });
        return { kind: 'unavailable' };
      }
      return { kind: 'redirect', url: slot.meetUrl! };
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

  private async alertUnavailable({
    slotId,
    reason,
  }: {
    slotId: number;
    reason: 'invalid_meet_url' | 'host_mismatch';
  }): Promise<void> {
    if (this.alertedSlotIds.has(slotId)) {
      return;
    }
    this.alertedSlotIds.add(slotId);
    const to = this.configService.get<string>('OPS_ALERT_EMAIL');
    if (!to) {
      this.logger.warn(`면접 입장 링크 사용 불가 (slotId=${slotId}, reason=${reason})`);
      return;
    }
    const text = `슬롯 ID: ${slotId}\n사유: ${reason}`;
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
