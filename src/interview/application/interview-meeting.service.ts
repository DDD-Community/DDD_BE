import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import { GoogleCalendarConnectionService } from '../../google-calendar/application/google-calendar-connection.service';
import { GoogleCalendarConnectionStatus } from '../../google-calendar/domain/google-calendar-connection.status';
import { NotificationService } from '../../notification/application/notification.service';
import { escapeHtml } from '../../notification/util/build-email';
import { InterviewRepository } from '../domain/interview.repository';
import { interviewMeetingEventId } from '../domain/interview-meeting-event-id';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { InterviewSlotMeetingStatus } from '../domain/interview-slot-meeting.status';

type MeetingFailureReason = 'not_connected' | 'reconnect_required' | 'request_failed';

@Injectable()
export class InterviewMeetingService {
  private readonly logger = new Logger(InterviewMeetingService.name);

  constructor(
    private readonly interviewRepository: InterviewRepository,
    private readonly calendarService: GoogleCalendarConnectionService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {}

  async syncSlotMeeting({ slotId }: { slotId: number }): Promise<void> {
    await this.interviewRepository.withSlotMeetingLock({
      slotId,
      work: () => this.syncSlotMeetingUnderLock({ slotId }),
    });
  }

  private async syncSlotMeetingUnderLock({ slotId }: { slotId: number }): Promise<void> {
    const slot = await this.interviewRepository.findSlotByIdIncludingDeleted({ id: slotId });
    if (!slot) {
      return;
    }
    if (slot.deletedAt) {
      if (slot.calendarEventId) {
        await this.clearMeeting({ slot });
      }
      return;
    }
    const interviewers = [...(slot.interviewers ?? [])].sort((a, b) => a.position - b.position);
    if (interviewers.length === 0) {
      await this.clearMeeting({ slot });
      return;
    }
    if (slot.endAt <= new Date()) {
      return;
    }
    const host = interviewers.find((interviewer) => interviewer.isHost);
    if (!host) {
      await this.recordFailure({ slot, hostUserId: null, reason: 'request_failed' });
      return;
    }

    try {
      const connections = await this.calendarService.findConnectionSummaries({
        userIds: interviewers.map((interviewer) => interviewer.userId),
      });
      const hostEmail = connections.get(host.userId)?.googleEmail ?? host.user?.email;
      const observerEmail = this.observerEmail();
      const attendeeEmails = [
        ...new Set(
          [
            ...interviewers
              .filter((interviewer) => !interviewer.isHost)
              .map((interviewer) => {
                const connection = connections.get(interviewer.userId);
                return connection?.status === GoogleCalendarConnectionStatus.ACTIVE
                  ? connection.googleEmail
                  : interviewer.user?.email;
              }),
            observerEmail,
          ].filter((email): email is string =>
            Boolean(email && email.toLowerCase() !== hostEmail?.toLowerCase()),
          ),
        ),
      ];
      const summary = `[DDD] ${slot.cohort?.name ?? ''} ${slot.cohortPart?.partName ?? ''} 면접`;
      const description = [
        slot.description,
        `정원 ${slot.capacity}명`,
        '예약한 지원자는 어드민 면접 슬롯 화면에서 확인할 수 있습니다.',
        '이 회의 링크를 지원자에게 직접 공유하지 마세요. 지원자는 안내 메일의 입장 링크로 들어옵니다.',
      ]
        .filter(Boolean)
        .join('\n');
      const request = {
        summary,
        description,
        startAt: slot.startAt,
        endAt: slot.endAt,
        attendeeEmails,
      };

      if (!slot.calendarEventId) {
        const { event, generation } = await this.createWithFreshId({
          slot,
          ownerUserId: host.userId,
          generation: slot.meetingGeneration,
          request,
        });
        await this.recordSuccess({
          slot,
          eventId: event.eventId,
          ownerUserId: host.userId,
          meetUrl: event.meetUrl,
          generation,
        });
        return;
      }

      if (slot.calendarOwnerUserId !== host.userId) {
        const oldOwnerUserId = slot.calendarOwnerUserId;
        const oldEventId = slot.calendarEventId;
        const { event, generation } = await this.createWithFreshId({
          slot,
          ownerUserId: host.userId,
          generation: slot.meetingGeneration + 1,
          request,
        });
        if (!event.meetUrl) {
          // 새 호스트의 Meet 생성이 지연되면 기존 초대를 유지한다. 다음 시도는 같은 ID의
          // 이벤트를 409 조회해 링크 준비 여부를 확인한다.
          await this.interviewRepository.updateMeetingState({
            slotId: slot.id,
            revision: slot.meetingRevision,
            patch: {
              meetingStatus: slot.meetUrl
                ? InterviewSlotMeetingStatus.OUT_OF_SYNC
                : InterviewSlotMeetingStatus.PENDING,
              meetingLastError: 'conference_pending',
              meetingRetryCount: slot.meetingRetryCount + 1,
            },
          });
          return;
        }
        const swapped = await this.recordSuccess({
          slot,
          eventId: event.eventId,
          ownerUserId: host.userId,
          meetUrl: event.meetUrl,
          generation,
        });
        if (swapped) {
          await this.deleteBestEffort({ slot, ownerUserId: oldOwnerUserId, eventId: oldEventId });
        }
        return;
      }

      const updated = await this.calendarService.updateMeetingEvent({
        ownerUserId: host.userId,
        eventId: slot.calendarEventId,
        ...request,
      });
      const event = updated.meetUrl
        ? updated
        : await this.calendarService.getMeetingEvent({
            ownerUserId: host.userId,
            eventId: slot.calendarEventId,
          });
      await this.recordSuccess({
        slot,
        eventId: slot.calendarEventId,
        ownerUserId: host.userId,
        meetUrl: event.meetUrl ?? slot.meetUrl,
      });
    } catch (error) {
      await this.recordFailure({
        slot,
        hostUserId: host.userId,
        reason: this.failureReason(error),
      });
    }
  }

  /**
   * 정해진 규칙의 ID 로 일정을 만든다. 그 ID 가 이미 삭제된 일정에 점유돼 있으면
   * (GOOGLE_CALENDAR_EVENT_ID_CONFLICT) 세대를 한 번 올려 새 ID 로 다시 만든다.
   */
  private async createWithFreshId({
    slot,
    ownerUserId,
    generation,
    request,
  }: {
    slot: InterviewSlot;
    ownerUserId: number;
    generation: number;
    request: {
      summary: string;
      description: string;
      startAt: Date;
      endAt: Date;
      attendeeEmails: string[];
    };
  }) {
    try {
      const event = await this.calendarService.createMeetingEvent({
        ownerUserId,
        eventId: interviewMeetingEventId({ uuid: slot.uuid, generation }),
        ...request,
      });
      return { event, generation };
    } catch (error) {
      if (
        !(error instanceof AppException) ||
        error.errorCode !== 'GOOGLE_CALENDAR_EVENT_ID_CONFLICT'
      ) {
        throw error;
      }
      const nextGeneration = generation + 1;
      const event = await this.calendarService.createMeetingEvent({
        ownerUserId,
        eventId: interviewMeetingEventId({ uuid: slot.uuid, generation: nextGeneration }),
        ...request,
      });
      return { event, generation: nextGeneration };
    }
  }

  async removeSlotMeeting({ slot }: { slot: InterviewSlot }): Promise<void> {
    await this.syncSlotMeeting({ slotId: slot.id });
  }

  private async clearMeeting({ slot }: { slot: InterviewSlot }): Promise<void> {
    if (slot.calendarEventId) {
      try {
        if (!slot.calendarOwnerUserId) {
          throw new Error('missing calendar owner');
        }
        await this.calendarService.deleteMeetingEvent({
          ownerUserId: slot.calendarOwnerUserId,
          eventId: slot.calendarEventId,
        });
      } catch (error) {
        const reason = this.failureReason(error);
        const previousStatus = slot.meetingStatus;
        const written = await this.interviewRepository.updateMeetingState({
          slotId: slot.id,
          revision: slot.meetingRevision,
          patch: {
            meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC,
            meetingLastError: reason,
            meetingRetryCount: slot.meetingRetryCount + 1,
          },
        });
        if (written && previousStatus !== InterviewSlotMeetingStatus.OUT_OF_SYNC) {
          await this.alertOps({ slot, hostUserId: slot.calendarOwnerUserId, reason });
        }
        return;
      }
    }
    await this.interviewRepository.updateMeetingState({
      slotId: slot.id,
      revision: slot.meetingRevision,
      patch: {
        calendarOwnerUserId: null,
        calendarEventId: null,
        meetUrl: null,
        // 지운 일정의 ID 는 Google 이 계속 점유한다. 면접관을 다시 넣을 때 새 ID 를 쓰도록 세대를 올린다.
        meetingGeneration: slot.calendarEventId
          ? slot.meetingGeneration + 1
          : slot.meetingGeneration,
        meetingStatus: InterviewSlotMeetingStatus.NONE,
        meetingRetryCount: 0,
        meetingLastError: null,
        meetingSyncedAt: new Date(),
      },
    });
  }

  private async recordSuccess({
    slot,
    eventId,
    ownerUserId,
    meetUrl,
    generation,
  }: {
    slot: InterviewSlot;
    eventId: string;
    ownerUserId: number;
    meetUrl: string | null;
    generation?: number;
  }): Promise<boolean> {
    return this.interviewRepository.updateMeetingState({
      slotId: slot.id,
      revision: slot.meetingRevision,
      patch: {
        calendarEventId: eventId,
        calendarOwnerUserId: ownerUserId,
        meetUrl,
        meetingGeneration: generation ?? slot.meetingGeneration,
        meetingStatus: meetUrl
          ? InterviewSlotMeetingStatus.READY
          : InterviewSlotMeetingStatus.PENDING,
        meetingLastError: meetUrl ? null : 'conference_pending',
        meetingRetryCount: 0,
        meetingSyncedAt: new Date(),
      },
    });
  }

  private async recordFailure({
    slot,
    hostUserId,
    reason,
  }: {
    slot: InterviewSlot;
    hostUserId: number | null;
    reason: MeetingFailureReason;
  }): Promise<void> {
    const previousStatus = slot.meetingStatus;
    const status = slot.meetUrl
      ? InterviewSlotMeetingStatus.OUT_OF_SYNC
      : InterviewSlotMeetingStatus.FAILED;
    const written = await this.interviewRepository.updateMeetingState({
      slotId: slot.id,
      revision: slot.meetingRevision,
      patch: {
        meetingStatus: status,
        meetingLastError: reason,
        meetingRetryCount: slot.meetingRetryCount + 1,
      },
    });
    if (written && previousStatus !== status) {
      await this.alertOps({ slot, hostUserId, reason });
    }
  }

  private async deleteBestEffort({
    slot,
    ownerUserId,
    eventId,
  }: {
    slot: InterviewSlot;
    ownerUserId: number | null;
    eventId: string | null;
  }): Promise<void> {
    if (!ownerUserId || !eventId) {
      return;
    }
    try {
      await this.calendarService.deleteMeetingEvent({ ownerUserId, eventId });
    } catch (error) {
      await this.alertOps({ slot, hostUserId: ownerUserId, reason: this.failureReason(error) });
    }
  }

  private observerEmail(): string | null {
    const configured = this.configService.get<string>('INTERVIEW_MEETING_OBSERVER_EMAIL');
    if (configured) {
      return configured;
    }
    const legacy = this.configService.get<string>('GOOGLE_CALENDAR_ID');
    if (!legacy || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(legacy)) {
      return null;
    }
    return legacy.toLowerCase().endsWith('@group.calendar.google.com') ? null : legacy;
  }

  private failureReason(error: unknown): MeetingFailureReason {
    if (error instanceof AppException) {
      if (error.errorCode === 'GOOGLE_CALENDAR_NOT_CONNECTED') {
        return 'not_connected';
      }
      if (error.errorCode === 'GOOGLE_CALENDAR_RECONNECT_REQUIRED') {
        return 'reconnect_required';
      }
    }
    return 'request_failed';
  }

  private async alertOps({
    slot,
    hostUserId,
    reason,
  }: {
    slot: InterviewSlot;
    hostUserId: number | null;
    reason: MeetingFailureReason;
  }): Promise<void> {
    const to = this.configService.get<string>('OPS_ALERT_EMAIL');
    if (!to) {
      return;
    }
    const text = `슬롯 ID: ${slot.id}\n기수/파트: ${slot.cohort?.name ?? ''} / ${slot.cohortPart?.partName ?? ''}\n호스트 사용자 ID: ${hostUserId ?? '없음'}\n사유: ${reason}`;
    try {
      await this.notificationService.sendEmail({
        to,
        subject: '[DDD][경고] 면접 슬롯 회의 동기화 실패',
        html: `<pre>${escapeHtml(text)}</pre>`,
        text,
      });
    } catch {
      this.logger.warn(`면접 슬롯 운영 알림 발송 실패 (slotId=${slot.id})`);
    }
  }
}
