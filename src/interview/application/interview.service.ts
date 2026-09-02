import { forwardRef, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { match } from 'ts-pattern';
import { runOnTransactionCommit, Transactional } from 'typeorm-transactional';

import { ApplicationStatus } from '../../application/domain/application.status';
import { ApplicationService } from '../../application/usecase/application.service';
import { AppException } from '../../common/exception/app.exception';
import { hasDefinedValues } from '../../common/util/object-utils';
import { isPostgresUniqueViolation } from '../../common/util/postgres-error';
import { NotificationService } from '../../notification/application/notification.service';
import { buildIcsFile } from '../../notification/util/build-ics';
import { InterviewRepository } from '../domain/interview.repository';
import type {
  ApplicantReservationCreateInput,
  InterviewSlotCreateInput,
  InterviewSlotUpdatePatch,
  ReservationCreateInput,
} from '../domain/interview.type';
import { InterviewReservation } from '../domain/interview-reservation.entity';
import { InterviewSlot } from '../domain/interview-slot.entity';
import { GoogleCalendarClient } from '../infrastructure/google-calendar.client';

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
  ) {}

  @Transactional()
  async createSlot({ input }: { input: InterviewSlotCreateInput }): Promise<InterviewSlot> {
    this.validateSlotRange({ startAt: input.startAt, endAt: input.endAt });
    const slot = InterviewSlot.create(input);
    return this.interviewRepository.saveSlot({ slot });
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

  @Transactional()
  async updateSlot({ id, patch }: { id: number; patch: InterviewSlotUpdatePatch }): Promise<void> {
    const slot = await this.interviewRepository.findSlotById({ id });
    if (!slot) {
      throw new AppException('INTERVIEW_SLOT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    const nextStartAt = patch.startAt ?? slot.startAt;
    const nextEndAt = patch.endAt ?? slot.endAt;
    this.validateSlotRange({ startAt: nextStartAt, endAt: nextEndAt });

    if (!hasDefinedValues(patch)) {
      return;
    }

    await this.interviewRepository.updateSlot({ id, patch });

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
      .filter((slot) => slot.startAt > now)
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

    await this.sendInterviewInviteEmail({ applicantName, applicantEmail, slot });
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
          .map((line) => this.escapeHtml(line))
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

  private async sendInterviewInviteEmail({
    applicantName,
    applicantEmail,
    slot,
  }: {
    applicantName: string;
    applicantEmail: string;
    slot: InterviewSlot;
  }): Promise<void> {
    try {
      const summary = `[DDD] 면접 일정 안내`;
      const ics = buildIcsFile({
        uid: `interview-${slot.id}-${applicantEmail}@dddstudy.kr`,
        summary,
        startAt: slot.startAt,
        endAt: slot.endAt,
        location: slot.location,
        description: slot.description,
      });

      const greeting = this.buildGreeting(applicantName);
      const dateLine = this.formatKstDate(slot.startAt);
      const timeLine = this.formatKstTimeRange({ startAt: slot.startAt, endAt: slot.endAt });
      const locationLine = this.renderLocationHtml(slot.location);

      await this.notificationService.sendEmail({
        to: applicantEmail,
        subject: '[DDD] 면접 일정이 확정되었습니다',
        html: this.renderInterviewHtml({ greeting, dateLine, timeLine, locationLine }),
        text: this.renderInterviewText({
          greeting,
          dateLine,
          timeLine,
          locationLine: slot.location,
        }),
        attachments: [
          {
            filename: 'interview.ics',
            content: ics,
            contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
          },
        ],
      });
    } catch (error) {
      this.logger.error(
        '면접 일정 안내 이메일 발송 실패 (예약은 저장됨)',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildGreeting(name: string): string {
    if (!name || name.includes('�')) {
      return '안녕하세요, 지원자님';
    }
    return `안녕하세요, ${this.escapeHtml(name)}님`;
  }

  /**
   * 온라인 면접이면 장소 자리에 미팅 링크가 들어온다. 그대로 두면 메일에서 클릭이 안 되므로
   * http(s) 로 시작할 때만 앵커로 감싼다. 그 외에는 기존처럼 escape 한 텍스트로 둔다.
   */
  private renderLocationHtml(location: string): string {
    // 판정과 출력이 같은 값을 봐야 한다. 원본으로 출력하면 href 에 앞뒤 공백이 섞인다.
    const trimmed = location.trim();
    const escaped = this.escapeHtml(trimmed);
    if (!/^https?:\/\/\S+$/.test(trimmed)) {
      return escaped;
    }
    return `<a href="${escaped}" style="color:#1a56db;text-decoration:underline;word-break:break-all;">${escaped}</a>`;
  }

  private formatKstDate(date: Date): string {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    }).format(date);
  }

  private formatKstTimeRange({ startAt, endAt }: { startAt: Date; endAt: Date }): string {
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${formatter.format(startAt)} ~ ${formatter.format(endAt)} (KST)`;
  }

  private renderInterviewHtml({
    greeting,
    dateLine,
    timeLine,
    locationLine,
  }: {
    greeting: string;
    dateLine: string;
    timeLine: string;
    locationLine: string;
  }): string {
    return `
<div style="margin:0;padding:0;background:#f4f6f8;font-family:'Apple SD Gothic Neo','Malgun Gothic',Arial,sans-serif;color:#111;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);max-width:560px;width:100%;">
          <tr>
            <td style="padding:32px 32px 16px 32px;">
              <div style="font-size:13px;letter-spacing:1px;color:#5b6470;font-weight:600;">DDD</div>
              <div style="font-size:22px;font-weight:700;line-height:1.4;color:#111;margin-top:8px;">면접 일정이 확정되었습니다</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 16px 32px;font-size:15px;line-height:1.65;color:#222;">
              <p style="margin:0 0 16px 0;">${greeting},</p>
              <p style="margin:0 0 24px 0;">DDD 면접 일정이 아래와 같이 안내되었습니다.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e5e9ef;">
                <tr>
                  <td style="padding:18px 20px;font-size:14px;color:#111;">
                    <div style="margin-bottom:10px;"><span style="display:inline-block;width:64px;color:#6b7280;font-weight:600;">일자</span><span>${dateLine}</span></div>
                    <div style="margin-bottom:10px;"><span style="display:inline-block;width:64px;color:#6b7280;font-weight:600;">시간</span><span>${timeLine}</span></div>
                    <div><span style="display:inline-block;width:64px;color:#6b7280;font-weight:600;">장소</span><span>${locationLine}</span></div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;font-size:14px;line-height:1.65;color:#374151;">
              <p style="margin:0 0 8px 0;">첨부된 <b>interview.ics</b> 파일을 클릭하면 본인 캘린더에 한 번에 추가됩니다.</p>
              <p style="margin:0;">변경/취소 등 문의는 운영진 이메일로 회신 부탁드립니다.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;border-top:1px solid #eef0f3;font-size:12px;color:#9097a3;">
              본 메일은 발신 전용입니다. © DDD
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</div>
    `.trim();
  }

  private renderInterviewText({
    greeting,
    dateLine,
    timeLine,
    locationLine,
  }: {
    greeting: string;
    dateLine: string;
    timeLine: string;
    locationLine: string;
  }): string {
    return [
      '[DDD] 면접 일정이 확정되었습니다',
      '',
      `${greeting},`,
      'DDD 면접 일정이 아래와 같이 안내되었습니다.',
      '',
      `일자  ${dateLine}`,
      `시간  ${timeLine}`,
      `장소  ${locationLine}`,
      '',
      '첨부된 interview.ics 파일을 클릭하면 본인 캘린더에 한 번에 추가됩니다.',
      '변경/취소 등 문의는 운영진 이메일로 회신 부탁드립니다.',
      '',
      '— DDD',
    ].join('\n');
  }

  private escapeHtml(input: string): string {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
}
