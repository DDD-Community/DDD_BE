import { forwardRef, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { match } from 'ts-pattern';
import { runOnTransactionCommit, Transactional } from 'typeorm-transactional';

import { ApplicationStatus } from '../../application/domain/application.status';
import { ApplicationService } from '../../application/usecase/application.service';
import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { toCohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { AppException } from '../../common/exception/app.exception';
import { hasDefinedValues } from '../../common/util/object-utils';
import { isPostgresUniqueViolation } from '../../common/util/postgres-error';
import { GoogleCalendarConnectionService } from '../../google-calendar/application/google-calendar-connection.service';
import { GoogleCalendarConnectionStatus } from '../../google-calendar/domain/google-calendar-connection.status';
import { NotificationService } from '../../notification/application/notification.service';
import type { EmailBlock, EmailInfoRow } from '../../notification/util/build-email';
import { buildEmail, escapeHtml, toEmailSubject } from '../../notification/util/build-email';
import { buildIcsFile } from '../../notification/util/build-ics';
import {
  diffMinutes,
  formatKoreanDateTime,
  formatKoreanDeadline,
} from '../../notification/util/format-korean-date';
import { UserService } from '../../user/application/user.service';
import { UserRole } from '../../user/domain/user.role';
import { InterviewRepository } from '../domain/interview.repository';
import type {
  ApplicantReservationCreateInput,
  InterviewSlotCreateInput,
  InterviewSlotUpdatePatch,
  ReservationCreateInput,
} from '../domain/interview.type';
import { InterviewReservation } from '../domain/interview-reservation.entity';
import { InterviewSlot } from '../domain/interview-slot.entity';
import {
  InterviewSlotMeetingStatus,
  isMeetingBookable,
} from '../domain/interview-slot-meeting.status';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';
import { InterviewJoinTokenService } from './interview-join-token.service';
import { InterviewMeetingService } from './interview-meeting.service';

const ONLINE_INTERVIEW = '온라인 (Google Meet)';

type CalendarFailureContext = {
  operation: 'create' | 'update' | 'delete';
  reservationId?: number;
  slotId?: number;
  eventId?: string;
};

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);
  private readonly pendingPostCommitTasks = new Set<Promise<unknown>>();

  constructor(
    private readonly interviewRepository: InterviewRepository,
    private readonly googleCalendarClient: GoogleCalendarClient,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => ApplicationService))
    private readonly applicationService: ApplicationService,
    private readonly userService: UserService,
    private readonly interviewMeetingService: InterviewMeetingService,
    private readonly calendarConnectionService: GoogleCalendarConnectionService,
    private readonly joinTokenService: InterviewJoinTokenService,
  ) {}

  createJoinUrlForReservation({
    reservation,
  }: {
    reservation: InterviewReservation;
  }): string | null {
    const slot = reservation.slot;
    if (!slot || !slot.meetingStatus || slot.meetingStatus === InterviewSlotMeetingStatus.NONE) {
      return null;
    }
    return this.joinTokenService.createUrl({ reservationId: reservation.id });
  }

  async createSlotWithMeeting({
    input,
  }: {
    input: InterviewSlotCreateInput;
  }): Promise<InterviewSlot> {
    const slot = await this.createSlot({ input });
    if (input.interviewerUserIds?.length) {
      await this.interviewMeetingService.syncSlotMeeting({ slotId: slot.id });
      return this.findSlotById({ id: slot.id });
    }
    return slot;
  }

  async updateSlotWithMeeting({
    id,
    patch,
  }: {
    id: number;
    patch: InterviewSlotUpdatePatch;
  }): Promise<InterviewSlot> {
    await this.updateSlot({ id, patch });
    const slot = await this.findSlotById({ id });
    if (
      slot.meetingStatus !== InterviewSlotMeetingStatus.NONE ||
      patch.interviewerUserIds !== undefined
    ) {
      await this.interviewMeetingService.syncSlotMeeting({ slotId: id });
      return this.findSlotById({ id });
    }
    return slot;
  }

  async deleteSlotWithMeeting({ id }: { id: number }): Promise<void> {
    const slot = await this.findSlotById({ id });
    await this.deleteSlot({ id });
    await this.interviewMeetingService.removeSlotMeeting({ slot });
  }

  @Transactional()
  async createSlot({ input }: { input: InterviewSlotCreateInput }): Promise<InterviewSlot> {
    this.validateSlotRange({ startAt: input.startAt, endAt: input.endAt });
    if (input.interviewerUserIds?.length) {
      await this.validateInterviewers({
        userIds: input.interviewerUserIds,
        startAt: input.startAt,
        endAt: input.endAt,
      });
    }
    const slot = InterviewSlot.create(input);
    const saved = await this.interviewRepository.saveSlot({ slot });
    if (input.interviewerUserIds?.length) {
      await this.interviewRepository.replaceSlotInterviewers({
        slotId: saved.id,
        userIds: input.interviewerUserIds,
      });
      await this.interviewRepository.updateMeetingState({
        slotId: saved.id,
        patch: { meetingStatus: InterviewSlotMeetingStatus.PENDING },
        bumpRevision: true,
      });
    }
    return saved;
  }

  async findSlotById({ id }: { id: number }): Promise<InterviewSlot> {
    const slot = await this.interviewRepository.findSlotById({ id });
    if (!slot) {
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return slot;
  }

  async findSlots({
    cohortId,
    cohortPartId,
  }: { cohortId?: number; cohortPartId?: number } = {}): Promise<InterviewSlot[]> {
    return this.interviewRepository.findSlots({ where: { cohortId, cohortPartId } });
  }

  async findInterviewerCandidates(): Promise<
    Array<{
      userId: number;
      name: string;
      email: string;
      roles: UserRole[];
      calendarConnected: boolean;
      calendarEmail: string | null;
    }>
  > {
    const users = await this.userService.findActiveUsersByRoles({
      roles: [UserRole.면접관, UserRole.운영자, UserRole.계정관리],
    });
    const summaries = await this.calendarConnectionService.findConnectionSummaries({
      userIds: users.map((user) => user.id),
    });
    return users.map((user) => {
      const connection = summaries.get(user.id);
      return {
        userId: user.id,
        name: `${user.lastName ?? ''}${user.firstName}`,
        email: user.email,
        roles: user.roles,
        calendarConnected: connection?.status === GoogleCalendarConnectionStatus.ACTIVE,
        calendarEmail: connection?.googleEmail ?? null,
      };
    });
  }

  async findSlotConnectionSummaries({ slots }: { slots: InterviewSlot[] }) {
    const userIds = [
      ...new Set(slots.flatMap((slot) => (slot.interviewers ?? []).map((row) => row.userId))),
    ];
    return this.calendarConnectionService.findConnectionSummaries({ userIds });
  }

  @Transactional()
  async updateSlot({ id, patch }: { id: number; patch: InterviewSlotUpdatePatch }): Promise<void> {
    const slot = await this.interviewRepository.findSlotById({ id });
    if (!slot) {
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const nextStartAt = patch.startAt ?? slot.startAt;
    const nextEndAt = patch.endAt ?? slot.endAt;
    this.validateSlotRange({ startAt: nextStartAt, endAt: nextEndAt });

    const currentIds = [...(slot.interviewers ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((row) => row.userId);
    const nextIds = patch.interviewerUserIds ?? currentIds;
    const listChanged =
      patch.interviewerUserIds !== undefined &&
      (nextIds.length !== currentIds.length ||
        nextIds.some((userId, index) => userId !== currentIds[index]));
    if (listChanged && nextIds.length === 0) {
      const reservationCount = await this.interviewRepository.countActiveReservationsBySlotId({
        slotId: id,
      });
      if (reservationCount > 0) {
        throw new AppException('INTERVIEW_INTERVIEWERS_REQUIRED', HttpStatus.CONFLICT);
      }
    }
    if (
      nextIds.length > 0 &&
      (listChanged || patch.startAt !== undefined || patch.endAt !== undefined)
    ) {
      await this.validateInterviewers({
        userIds: nextIds,
        startAt: nextStartAt,
        endAt: nextEndAt,
        excludeSlotId: id,
      });
    }

    if (!hasDefinedValues(patch)) {
      return;
    }

    const slotPatch = {
      startAt: patch.startAt,
      endAt: patch.endAt,
      capacity: patch.capacity,
      location: patch.location,
      description: patch.description,
    };
    await this.interviewRepository.updateSlot({ id, patch: slotPatch });
    if (listChanged) {
      await this.interviewRepository.replaceSlotInterviewers({ slotId: id, userIds: nextIds });
      await this.interviewRepository.updateMeetingState({
        slotId: id,
        bumpRevision: true,
        patch: {
          meetingStatus:
            nextIds.length === 0
              ? InterviewSlotMeetingStatus.OUT_OF_SYNC
              : slot.calendarEventId
                ? InterviewSlotMeetingStatus.OUT_OF_SYNC
                : InterviewSlotMeetingStatus.PENDING,
          meetingRetryCount: 0,
        },
      });
    } else if (
      nextIds.length > 0 &&
      [patch.startAt, patch.endAt, patch.description, patch.location, patch.capacity].some(
        (value) => value !== undefined,
      )
    ) {
      await this.interviewRepository.updateMeetingState({
        slotId: id,
        bumpRevision: true,
        patch: {
          meetingStatus: slot.calendarEventId
            ? InterviewSlotMeetingStatus.OUT_OF_SYNC
            : InterviewSlotMeetingStatus.PENDING,
        },
      });
    }

    const calendarRelevantChanged =
      patch.startAt !== undefined ||
      patch.endAt !== undefined ||
      patch.location !== undefined ||
      patch.description !== undefined;
    if (!calendarRelevantChanged) {
      return;
    }

    const reservationsToSync = (slot.reservations ?? []).filter(
      (reservation) => reservation.calendarEventId,
    );
    if (reservationsToSync.length === 0) {
      return;
    }

    const nextLocation = patch.location ?? slot.location;
    const nextDescription = patch.description ?? slot.description;

    runOnTransactionCommit(() => {
      this.schedulePostCommit(() =>
        this.afterUpdateSlot({
          slotId: id,
          startAt: nextStartAt,
          endAt: nextEndAt,
          location: nextLocation,
          description: nextDescription,
          reservations: reservationsToSync,
        }),
      );
    });
  }

  @Transactional()
  async deleteSlot({ id }: { id: number }): Promise<void> {
    const slot = await this.interviewRepository.findSlotById({ id });
    if (!slot) {
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    await this.interviewRepository.deleteSlot({ id });
    if (slot.calendarEventId) {
      await this.interviewRepository.updateMeetingState({
        slotId: id,
        bumpRevision: true,
        patch: { meetingStatus: InterviewSlotMeetingStatus.OUT_OF_SYNC, meetingRetryCount: 0 },
      });
    }
  }

  async hasSlotsForCohortPart({ cohortPartId }: { cohortPartId: number }): Promise<boolean> {
    const count = await this.interviewRepository.countSlotsByCohortPartId({ cohortPartId });
    return count > 0;
  }

  @Transactional()
  async createReservation({
    input,
  }: {
    input: ReservationCreateInput;
  }): Promise<InterviewReservation> {
    // 지원자 예약 경로와 같은 행 잠금을 타야 교차 경로 정원 초과가 없다.
    const slot = await this.interviewRepository.findSlotByIdForUpdate({ id: input.slotId });
    if (!slot) {
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    if (!isMeetingBookable(slot.meetingStatus ?? InterviewSlotMeetingStatus.NONE)) {
      throw new AppException('INTERVIEW_SLOT_MEETING_NOT_READY', HttpStatus.CONFLICT);
    }

    const currentCount = await this.interviewRepository.countActiveReservationsBySlotId({
      slotId: input.slotId,
    });
    if (currentCount >= slot.capacity) {
      throw new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT);
    }

    const duplicate = await this.interviewRepository.findReservationByApplicationFormId({
      applicationFormId: input.applicationFormId,
    });
    if (duplicate) {
      throw new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT);
    }

    const reservation = InterviewReservation.create({
      slotId: input.slotId,
      applicationFormId: input.applicationFormId,
    });

    try {
      const saved = await this.interviewRepository.saveReservation({ reservation });

      runOnTransactionCommit(() => {
        this.schedulePostCommit(() =>
          this.afterCreateReservation({
            reservationId: saved.id,
            applicantName: input.applicantName,
            applicantEmail: input.applicantEmail,
            slot,
          }),
        );
      });

      return saved;
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new AppException('INTERVIEW_SLOT_ALREADY_RESERVED', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async findOpenSlotsForBooking({
    cohortPartId,
  }: {
    cohortPartId: number;
  }): Promise<Array<{ slot: InterviewSlot; remainingSeats: number }>> {
    const slots = await this.interviewRepository.findSlots({ where: { cohortPartId } });
    const now = new Date();
    return slots
      .filter(
        (slot) =>
          slot.startAt > now &&
          isMeetingBookable(slot.meetingStatus ?? InterviewSlotMeetingStatus.NONE),
      )
      .map((slot) => ({
        slot,
        remainingSeats: Math.max(0, slot.capacity - (slot.reservations?.length ?? 0)),
      }));
  }

  async findActiveReservationByApplicationFormId({
    applicationFormId,
  }: {
    applicationFormId: number;
  }): Promise<InterviewReservation | null> {
    return this.interviewRepository.findReservationByApplicationFormId({ applicationFormId });
  }

  @Transactional()
  async createReservationByApplicant({
    input,
  }: {
    input: ApplicantReservationCreateInput;
  }): Promise<InterviewReservation> {
    // 잠금 순서는 지원서 -> 슬롯으로 고정한다. 어드민의 상태 변경(지원서 UPDATE)과 같은 방향이라
    // 락 사이클이 생기지 않고, 훗날 "탈락 시 예약 자동 취소"(지원서 -> 예약/슬롯)가 붙어도
    // 순서가 어긋나지 않는다.
    //
    // 자격 검증은 예약 INSERT 와 같은 트랜잭션 + 같은 행 잠금 안에 있어야 한다. 잠금 없는 조회는
    // READ COMMITTED 에서 어드민 커밋을 막지 못해, 검증 직후 탈락 처리된 지원자의 예약이
    // 그대로 커밋된다.
    const form = await this.applicationService.findFormByIdForUpdate({
      id: input.applicationFormId,
    });
    // 토큰은 면접 종료일까지 살아 있으므로, 이후 탈락 처리된 지원자의 재예약을 상태로 막는다.
    //
    // 수신 이메일도 여기서 확인한다. 탈퇴(soft-delete)한 회원은 leftJoin 결과가 비어 form.user 가
    // 사라지는데, 이를 통과시키면 확정 메일을 보내는 커밋 후 훅에서 TypeError 가 나고
    // 그 시점엔 예약이 이미 커밋된 뒤라 되돌릴 수도 없다.
    const applicantEmail = form.user?.email;
    if (
      form.status !== ApplicationStatus.서류합격 ||
      form.cohortPartId !== input.cohortPartId ||
      !applicantEmail
    ) {
      throw new AppException('INTERVIEW_BOOKING_NOT_ELIGIBLE', HttpStatus.FORBIDDEN);
    }

    // 행 잠금으로 같은 슬롯의 동시 예약을 직렬화한다 — 정원 검사와 INSERT 가 원자적이 된다.
    const slot = await this.interviewRepository.findSlotByIdForUpdate({ id: input.slotId });
    if (!slot || slot.cohortPartId !== input.cohortPartId) {
      // 타 직군 슬롯은 존재 자체를 숨긴다
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    if (!isMeetingBookable(slot.meetingStatus ?? InterviewSlotMeetingStatus.NONE)) {
      throw new AppException('INTERVIEW_SLOT_MEETING_NOT_READY', HttpStatus.CONFLICT);
    }
    if (slot.startAt <= new Date()) {
      throw new AppException('INTERVIEW_SLOT_CLOSED', HttpStatus.BAD_REQUEST);
    }

    const duplicate = await this.interviewRepository.findReservationByApplicationFormId({
      applicationFormId: input.applicationFormId,
    });
    if (duplicate) {
      throw new AppException('INTERVIEW_RESERVATION_EXISTS', HttpStatus.CONFLICT);
    }

    const currentCount = await this.interviewRepository.countActiveReservationsBySlotId({
      slotId: input.slotId,
    });
    if (currentCount >= slot.capacity) {
      throw new AppException('INTERVIEW_SLOT_FULL', HttpStatus.CONFLICT);
    }

    const reservation = InterviewReservation.create({
      slotId: input.slotId,
      applicationFormId: input.applicationFormId,
    });

    try {
      const saved = await this.interviewRepository.saveReservation({ reservation });
      // 응답 DTO 가 슬롯 일정·장소를 내보낼 수 있도록 잠금 조회한 슬롯을 붙인다.
      saved.slot = slot;

      runOnTransactionCommit(() => {
        this.schedulePostCommit(() =>
          this.afterCreateReservation({
            reservationId: saved.id,
            applicantName: form.applicantName,
            applicantEmail,
            slot,
          }),
        );
      });

      return saved;
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new AppException('INTERVIEW_RESERVATION_EXISTS', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async findReservationsBySlotId({ slotId }: { slotId: number }): Promise<InterviewReservation[]> {
    return this.interviewRepository.findReservations({ where: { slotId } });
  }

  @Transactional()
  async cancelReservation({ id }: { id: number }): Promise<void> {
    const reservation = await this.interviewRepository.findReservationById({ id });
    if (!reservation) {
      throw new AppException('INTERVIEW_RESERVATION_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    await this.interviewRepository.deleteReservation({ id });

    const eventId = reservation.calendarEventId;
    if (!eventId) {
      return;
    }

    runOnTransactionCommit(() => {
      this.schedulePostCommit(() => this.afterCancelReservation({ reservationId: id, eventId }));
    });
  }

  private async afterCreateReservation({
    reservationId,
    applicantName,
    applicantEmail,
    slot,
  }: {
    reservationId: number;
    applicantName: string;
    applicantEmail: string;
    slot: InterviewSlot;
  }): Promise<void> {
    if (slot.meetingStatus === InterviewSlotMeetingStatus.NONE || !slot.meetingStatus) {
      try {
        const eventId = await this.googleCalendarClient.createEvent({
          summary: `[DDD] 면접 - ${applicantName}`,
          startAt: slot.startAt,
          endAt: slot.endAt,
          location: slot.location,
          description: slot.description,
        });
        await this.persistReservationCalendarEvent({ reservationId, eventId });
      } catch (error) {
        this.logger.error('구글 캘린더 이벤트 생성 실패 (예약은 저장됨)', error);
        await this.notifyOpsCalendarFailure({
          context: { operation: 'create', reservationId, slotId: slot.id },
          error,
        });
      }
    }

    // 잠금 조회한 슬롯에는 관계가 없다. 메일 문구에 쓸 기수 정보를 여기서 채운다.
    // 커밋 이후라 실패해도 예약에는 영향이 없다.
    const slotWithCohort = await this.interviewRepository.findSlotById({ id: slot.id });
    const cohort = toCohortAnnouncementInfo({
      name: slotWithCohort?.cohort?.name,
      process: slotWithCohort?.cohort?.process,
    });

    await this.sendInterviewInviteEmail({
      reservationId,
      applicantName,
      applicantEmail,
      slot,
      cohort,
      partName: slotWithCohort?.cohortPart?.partName ?? null,
    });
  }

  private async afterCancelReservation({
    reservationId,
    eventId,
  }: {
    reservationId: number;
    eventId: string;
  }): Promise<void> {
    try {
      await this.googleCalendarClient.deleteEvent({ eventId });
    } catch (error) {
      this.logger.error(`구글 캘린더 이벤트 삭제 실패 (eventId=${eventId})`, error);
      await this.notifyOpsCalendarFailure({
        context: { operation: 'delete', reservationId, eventId },
        error,
      });
    }
  }

  private async afterUpdateSlot({
    slotId,
    startAt,
    endAt,
    location,
    description,
    reservations,
  }: {
    slotId: number;
    startAt: Date;
    endAt: Date;
    location?: string;
    description?: string;
    reservations: InterviewReservation[];
  }): Promise<void> {
    for (const reservation of reservations) {
      const eventId = reservation.calendarEventId;
      if (!eventId) {
        continue;
      }
      try {
        await this.googleCalendarClient.updateEvent({
          eventId,
          startAt,
          endAt,
          location,
          description,
        });
      } catch (error) {
        this.logger.error(`구글 캘린더 이벤트 업데이트 실패 (eventId=${eventId})`, error);
        await this.notifyOpsCalendarFailure({
          context: { operation: 'update', reservationId: reservation.id, slotId, eventId },
          error,
        });
      }
    }
  }

  @Transactional()
  private async persistReservationCalendarEvent({
    reservationId,
    eventId,
  }: {
    reservationId: number;
    eventId: string;
  }): Promise<void> {
    const reservation = await this.interviewRepository.findReservationById({ id: reservationId });
    if (!reservation) {
      this.logger.warn(
        `캘린더 이벤트 ID 저장 대상 예약을 찾을 수 없습니다 (reservationId=${reservationId}).`,
      );
      return;
    }
    reservation.assignCalendarEvent(eventId);
    await this.interviewRepository.saveReservation({ reservation });
  }

  private async notifyOpsCalendarFailure({
    context,
    error,
  }: {
    context: CalendarFailureContext;
    error: unknown;
  }): Promise<void> {
    const opsEmail = this.configService.get<string>('OPS_ALERT_EMAIL');
    if (!opsEmail) {
      this.logger.warn(`OPS_ALERT_EMAIL 미설정으로 운영 알림을 건너뜁니다 (${context.operation}).`);
      return;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const subject = `[DDD][경고] 구글 캘린더 ${this.formatOperation(context.operation)} 실패`;
    const detailLines = [
      `작업: ${this.formatOperation(context.operation)}`,
      context.reservationId ? `예약 ID: ${context.reservationId}` : null,
      context.slotId ? `슬롯 ID: ${context.slotId}` : null,
      context.eventId ? `이벤트 ID: ${context.eventId}` : null,
      `에러: ${errorMessage}`,
    ].filter((line): line is string => Boolean(line));

    try {
      await this.notificationService.sendEmail({
        to: opsEmail,
        subject,
        html: `<pre style="font-family:'Apple SD Gothic Neo','Malgun Gothic',monospace;font-size:13px;line-height:1.6;color:#111;">${detailLines
          .map((line) => escapeHtml(line))
          .join('\n')}</pre>`,
        text: detailLines.join('\n'),
      });
    } catch (notifyError) {
      this.logger.error(
        '운영 알림 메일 발송 실패 (캘린더 실패 알림)',
        notifyError instanceof Error ? notifyError.stack : String(notifyError),
      );
    }
  }

  private formatOperation(operation: CalendarFailureContext['operation']): string {
    return match(operation)
      .with('create', () => '이벤트 생성')
      .with('update', () => '이벤트 업데이트')
      .with('delete', () => '이벤트 삭제')
      .exhaustive();
  }

  private schedulePostCommit(task: () => Promise<void>): void {
    const promise = task()
      .catch((error: unknown) => {
        this.logger.error('post-commit task failed', error);
      })
      .finally(() => {
        this.pendingPostCommitTasks.delete(promise);
      });
    this.pendingPostCommitTasks.add(promise);
  }

  private validateSlotRange({ startAt, endAt }: { startAt: Date; endAt: Date }): void {
    if (endAt.getTime() <= startAt.getTime()) {
      throw new AppException('INVALID_INTERVIEW_SLOT_RANGE', HttpStatus.BAD_REQUEST);
    }
  }

  private async validateInterviewers({
    userIds,
    startAt,
    endAt,
    excludeSlotId,
  }: {
    userIds: number[];
    startAt: Date;
    endAt: Date;
    excludeSlotId?: number;
  }): Promise<void> {
    if (new Set(userIds).size !== userIds.length || userIds.length > 10) {
      throw new AppException('INTERVIEW_INTERVIEWER_INVALID', HttpStatus.BAD_REQUEST);
    }
    const users = await this.userService.findActiveUsersWithRoles({ ids: userIds });
    const allowed = [UserRole.면접관, UserRole.운영자, UserRole.계정관리];
    if (
      users.length !== userIds.length ||
      users.some((user) => !user.roles.some((role) => allowed.includes(role)))
    ) {
      throw new AppException('INTERVIEW_INTERVIEWER_INVALID', HttpStatus.BAD_REQUEST);
    }
    await this.interviewRepository.acquireHostTimeLock({ hostUserId: userIds[0] });
    const conflict = await this.interviewRepository.hasHostTimeConflict({
      hostUserId: userIds[0],
      startAt,
      endAt,
      excludeSlotId,
    });
    if (conflict) {
      throw new AppException('INTERVIEW_HOST_TIME_CONFLICT', HttpStatus.CONFLICT);
    }
  }

  private async sendInterviewInviteEmail({
    reservationId,
    applicantName,
    applicantEmail,
    slot,
    cohort,
    partName,
  }: {
    reservationId: number;
    applicantName: string;
    applicantEmail: string;
    slot: InterviewSlot;
    cohort: CohortAnnouncementInfo;
    partName: string | null;
  }): Promise<void> {
    try {
      const summary = `[DDD] 면접 일정 안내`;
      const isMeetMode = Boolean(
        slot.meetingStatus && slot.meetingStatus !== InterviewSlotMeetingStatus.NONE,
      );
      const joinUrl = isMeetMode ? this.joinTokenService.createUrl({ reservationId }) : null;
      const ics = buildIcsFile({
        uid: `interview-${slot.id}-${applicantEmail}@dddstudy.kr`,
        summary,
        startAt: slot.startAt,
        endAt: slot.endAt,
        location: joinUrl ?? slot.location,
        description: joinUrl
          ? `${slot.description ? `${slot.description}\n\n` : ''}입장 링크: ${joinUrl}\n시작 10분 전부터 입장할 수 있습니다.`
          : slot.description,
      });

      const scheduledAt = formatKoreanDateTime(slot.startAt);
      // 기수에 지정한 값이 있으면 그쪽을 쓴다. 없으면 슬롯 길이가 곧 답이다.
      const durationMinutes =
        cohort.interviewDurationMinutes ??
        diffMinutes({ startAt: slot.startAt, endAt: slot.endAt });
      // 이름이 비어 있으면 "님, 인터뷰가..." 가 나가므로 호칭을 일반화한다.
      const trimmedName = applicantName.trim();
      const safeName = trimmedName.length > 0 ? escapeHtml(trimmedName) : '지원자';

      const rows: EmailInfoRow[] = [
        { label: '일시', valueHtml: escapeHtml(scheduledAt), valueText: scheduledAt },
      ];
      if (durationMinutes > 0) {
        const duration = `약 ${durationMinutes}분`;
        rows.push({ label: '소요 시간', valueHtml: duration, valueText: duration });
      }
      rows.push({ label: '진행 방식', valueHtml: ONLINE_INTERVIEW, valueText: ONLINE_INTERVIEW });
      if (partName) {
        rows.push({ label: '지원 파트', valueHtml: escapeHtml(partName), valueText: partName });
      }

      // 장소가 미팅 링크일 때만 버튼으로 보낸다. "추후 안내" 같은 문구를 href 에 넣으면
      // 눌러도 아무 데도 가지 않는 버튼이 되므로, 그때는 장소 줄로 그대로 보여준다.
      const location = isMeetMode ? '' : slot.location.trim();
      const meetingLink = joinUrl ?? (/^https?:\/\/\S+$/.test(location) ? location : null);
      if (!isMeetMode && !meetingLink) {
        rows.push({ label: '장소', valueHtml: escapeHtml(location), valueText: location });
      }

      const rescheduleDeadline = cohort.interviewRescheduleDeadline
        ? escapeHtml(formatKoreanDeadline(cohort.interviewRescheduleDeadline))
        : '인터뷰 전날';

      const blocks: EmailBlock[] = [
        { type: 'lead', html: `${safeName}님, 인터뷰가 아래 일정으로 확정되었습니다.` },
        { type: 'info', rows },
      ];
      if (meetingLink) {
        blocks.push({ type: 'button', label: '인터뷰 참여하기', href: meetingLink });
      }
      if (isMeetMode) {
        blocks.push({
          type: 'note',
          lines: [
            '시작 10분 전부터 입장할 수 있습니다. 입장 후 면접관이 수락할 때까지 잠시 기다려 주세요.',
          ],
        });
      }
      blocks.push(
        { type: 'note', lines: ['시작 5분 전까지 접속 환경과 마이크를 확인해 주세요.'] },
        {
          type: 'note',
          lines: [`일정 조정이 필요하면 ${rescheduleDeadline}까지 본 메일로 회신해 주세요.`],
        },
      );

      const title = '면접 일정이 확정되었습니다';
      const { html, text } = buildEmail({
        title,
        blocks,
      });

      await this.notificationService.sendEmail({
        to: applicantEmail,
        subject: toEmailSubject(title),
        html,
        text,
        attachments: [
          {
            filename: 'interview.ics',
            content: ics,
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ],
      });
    } catch {
      // 발송 오류에는 수신자와 본문(입장 토큰)이 포함될 수 있어 원문을 기록하지 않는다.
      this.logger.error('면접 일정 안내 이메일 발송 실패 (예약은 저장됨)');
    }
  }
}
