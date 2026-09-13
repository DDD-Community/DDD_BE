import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { match } from 'ts-pattern';

import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { InterviewBookingTokenService } from '../../interview/application/interview-booking-token.service';
import { NotificationService } from '../../notification/application/notification.service';
import type { EmailBlock, EmailInfoRow } from '../../notification/util/build-email';
import { buildEmail, escapeHtml, toEmailSubject } from '../../notification/util/build-email';
import {
  formatKoreanDateTime,
  formatKoreanDeadline,
} from '../../notification/util/format-korean-date';
import type { AnnouncementStatus } from '../domain/application.status';
import { ApplicationStatus, isAnnouncementStatus } from '../domain/application.status';
import type {
  ApplicationStatusChangedEventPayload,
  ApplicationSubmittedEventPayload,
  RenderedStatusEmailTemplate,
} from './email-event.type';

const ONLINE_INTERVIEW = '온라인 (Google Meet)';
const NEXT_COHORT_NOTICE = '다음 기수 소식은 DDD 홈페이지와 인스타그램에서 안내드립니다.';

@Injectable()
export class EmailEventHandler {
  private readonly logger = new Logger(EmailEventHandler.name);
  constructor(
    private readonly notificationService: NotificationService,
    private readonly bookingTokenService: InterviewBookingTokenService,
    private readonly configService: ConfigService,
  ) {}

  @OnEvent('application.submitted')
  async handleApplicationSubmittedEvent(payload: ApplicationSubmittedEventPayload): Promise<void> {
    this.logger.log(`[이메일 이벤트] 지원서 최종 제출 완료 안내 메일 발송`);
    try {
      const { cohort } = payload;
      const submittedAt = formatKoreanDateTime(payload.submittedAt);
      const rows: EmailInfoRow[] = [];
      if (cohort.name) {
        const cohortName = `DDD ${escapeHtml(cohort.name)}`;
        rows.push({ label: '지원 기수', valueHtml: cohortName, valueText: `DDD ${cohort.name}` });
      }
      if (payload.partName) {
        rows.push({
          label: '지원 파트',
          valueHtml: escapeHtml(payload.partName),
          valueText: payload.partName,
        });
      }
      rows.push({ label: '접수 일시', valueHtml: submittedAt, valueText: submittedAt });

      // 발표일이 비어 있으면 "undefined부터" 가 나가지 않도록 날짜 없는 문장으로 바꾼다.
      const resultNotice = cohort.documentResultDate
        ? `서류 전형 결과는 ${escapeHtml(formatKoreanDeadline(cohort.documentResultDate))}부터 순차적으로 안내드립니다.`
        : '서류 전형 결과는 추후 이메일로 안내드립니다.';

      const title = '지원서 접수가 완료되었습니다';
      const { html, text } = buildEmail({
        title,
        blocks: [
          {
            type: 'lead',
            html: `${escapeHtml(payload.name)}님, 지원서가 정상적으로 접수되었습니다.`,
          },
          { type: 'info', rows },
          { type: 'note', lines: [resultNotice, '지원해 주셔서 감사합니다.'] },
        ],
      });

      return await this.notificationService.sendEmail({
        to: payload.email,
        subject: toEmailSubject(title),
        html,
        text,
      });
    } catch (error) {
      this.logger.error(
        '지원서 접수 이메일 발송 실패',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent('application.status_changed')
  async handleApplicationStatusChangedEvent(
    payload: ApplicationStatusChangedEventPayload,
  ): Promise<void> {
    if (!isAnnouncementStatus(payload.newStatus)) {
      return;
    }

    this.logger.log(`[이메일 이벤트] 지원서 상태 변경 안내 메일 발송`);
    try {
      const template = this.buildStatusEmailTemplate(payload, payload.newStatus);

      return await this.notificationService.sendEmail({
        to: payload.email,
        ...template,
      });
    } catch (error) {
      this.logger.error(
        '지원 상태 변경 이메일 발송 실패',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildStatusEmailTemplate(
    payload: ApplicationStatusChangedEventPayload,
    newStatus: AnnouncementStatus,
  ): RenderedStatusEmailTemplate {
    return (
      match(newStatus)
        .returnType<RenderedStatusEmailTemplate>()
        .with(ApplicationStatus.서류합격, () => this.buildDocumentPassEmail(payload))
        .with(ApplicationStatus.서류불합격, () => this.buildDocumentFailEmail(payload))
        // 면접합격이 지원자에게 알리는 최종 합격 시점이다. 참가비·입금 안내가 여기서 나가고,
        // 최종합격은 운영진이 입금을 확인해 올리는 내부 단계라 메일이 없다.
        .with(ApplicationStatus.면접합격, () => this.buildFinalPassEmail(payload))
        .with(ApplicationStatus.최종불합격, () => this.buildInterviewFailEmail(payload))
        .exhaustive()
    );
  }

  /**
   * "DDD 14기" 또는 기수명이 없으면 "DDD".
   *
   * 기수명은 운영진 입력값이라 escape 한다. buildEmail 은 escape 된 값을 받는 계약이고,
   * text 버전은 stripHtml 이 되돌리므로 escape 해야 html/text 본문이 같아진다.
   */
  private cohortLabel(cohort: CohortAnnouncementInfo): string {
    return cohort.name ? `DDD ${escapeHtml(cohort.name)}` : 'DDD';
  }

  private buildDocumentPassEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const bookingLink = this.buildBookingLink(payload);
    const safeName = escapeHtml(payload.name);

    const rows: EmailInfoRow[] = [];
    if (payload.partName) {
      rows.push({
        label: '지원 파트',
        valueHtml: escapeHtml(payload.partName),
        valueText: payload.partName,
      });
    }
    rows.push({ label: '면접 방식', valueHtml: ONLINE_INTERVIEW, valueText: ONLINE_INTERVIEW });

    // 링크를 만들지 못했으면 "아래에서 예약하라"는 안내와 버튼이 거짓말이 된다.
    const blocks: EmailBlock[] = bookingLink
      ? [
          {
            type: 'lead',
            html: `${safeName}님, 축하드립니다. 아래에서 면접 시간을 예약해 주세요.`,
          },
          { type: 'info', rows },
          { type: 'button', label: '면접 시간 예약하기', href: bookingLink },
          { type: 'note', lines: ['예약 후에는 시간을 변경할 수 없습니다.'] },
          { type: 'linkFallback', href: bookingLink },
        ]
      : [
          {
            type: 'lead',
            html: `${safeName}님, 축하드립니다. 면접 일정은 운영진이 별도로 안내드립니다.`,
          },
          { type: 'info', rows },
        ];

    const title = '서류 전형에 합격하셨습니다';
    const { html, text } = buildEmail({ title, blocks });
    return { subject: toEmailSubject(title), html, text };
  }

  private buildDocumentFailEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const title = '서류 전형 결과를 안내드립니다';
    const { html, text } = buildEmail({
      title,
      blocks: [
        {
          type: 'lead',
          html: `${escapeHtml(payload.name)}님, ${this.cohortLabel(payload.cohort)}에 지원해 주셔서 감사합니다.`,
        },
        {
          type: 'lead',
          html: '제한된 모집 인원으로 인해 아쉽게도 이번 서류 전형에서는 함께하지 못하게 되었습니다.',
        },
        {
          type: 'lead',
          html: '소중한 시간 내어 주신 점 감사드리며, 앞으로의 활동을 응원하겠습니다.',
        },
        { type: 'note', lines: [NEXT_COHORT_NOTICE] },
      ],
    });

    return { subject: toEmailSubject(title), html, text };
  }

  private buildInterviewFailEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const title = '면접 전형 결과를 안내드립니다';
    const { html, text } = buildEmail({
      title,
      blocks: [
        {
          type: 'lead',
          html: `${escapeHtml(payload.name)}님, ${this.cohortLabel(payload.cohort)} 면접에 참여해 주셔서 감사합니다.`,
        },
        {
          type: 'lead',
          html: '신중하게 논의한 결과, 아쉽게도 이번 기수에서는 함께하지 못하게 되었습니다.',
        },
        {
          type: 'lead',
          html: '귀한 시간 내어 주신 점 감사드리며, 앞으로의 활동을 응원하겠습니다.',
        },
        { type: 'note', lines: [NEXT_COHORT_NOTICE] },
      ],
    });

    return { subject: toEmailSubject(title), html, text };
  }

  private buildFinalPassEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const { cohort } = payload;

    // 기수 process 에 없는 항목은 줄째 생략한다. 잘못된 계좌나 "undefined" 가 나가는 것보다 낫다.
    const rows: EmailInfoRow[] = [];
    if (cohort.participationFee !== null) {
      const fee = `${cohort.participationFee.toLocaleString('ko-KR')}원`;
      rows.push({ label: '참가비', valueHtml: fee, valueText: fee });
    }
    if (cohort.bankAccount) {
      rows.push({
        label: '입금 계좌',
        valueHtml: escapeHtml(cohort.bankAccount),
        valueText: cohort.bankAccount,
      });
    }
    if (cohort.accountHolder) {
      rows.push({
        label: '예금주',
        valueHtml: escapeHtml(cohort.accountHolder),
        valueText: cohort.accountHolder,
      });
    }
    if (cohort.participationConfirmDeadline) {
      const deadline = formatKoreanDeadline(cohort.participationConfirmDeadline);
      rows.push({ label: '회신 기한', valueHtml: escapeHtml(deadline), valueText: deadline });
    }

    const title = `${this.cohortLabel(cohort)} 최종 합격을 축하드립니다`;
    const { html, text } = buildEmail({
      title,
      blocks: [
        {
          type: 'lead',
          html: `${escapeHtml(payload.name)}님, 함께하실 의사가 있다면 기한 내 참가비 입금과 회신을 완료해 주세요.`,
        },
        { type: 'info', rows },
        {
          type: 'box',
          heading: '회신 양식',
          lines: ['이름 / 지원 파트 / 입금자명', '참가 여부 : 참여합니다', '입금 완료 여부 : 완료'],
        },
        {
          type: 'note',
          lines: [
            '입금 후 위 양식대로 <strong>본 메일에 회신</strong>해 주세요.',
            '기한 내 입금과 회신이 확인되지 않으면 합격이 취소될 수 있습니다.',
          ],
        },
      ],
    });

    // 제목에 들어간 기수명은 escape 된 값이라 제목줄에는 원문을 쓴다.
    return {
      subject: toEmailSubject(`${this.cohortLabelText(cohort)} 최종 합격을 축하드립니다`),
      html,
      text,
    };
  }

  private cohortLabelText(cohort: CohortAnnouncementInfo): string {
    return cohort.name ? `DDD ${cohort.name}` : 'DDD';
  }

  private buildBookingLink(payload: ApplicationStatusChangedEventPayload): string | null {
    const { cohortId, partName } = payload;
    if (cohortId === null || partName === null) {
      this.logger.error(
        `기수 정보가 없어 서류합격 메일을 예약 링크 없이 발송합니다. applicationFormId=${payload.applicationFormId}`,
      );
      return null;
    }

    const baseUrl = this.configService.get<string>('INTERVIEW_BOOKING_URL');
    if (!baseUrl) {
      this.logger.error(
        'INTERVIEW_BOOKING_URL 이 설정되지 않아 서류합격 메일을 예약 링크 없이 발송합니다.',
      );
      return null;
    }
    const token = this.bookingTokenService.issue({
      applicationFormId: payload.applicationFormId,
      cohortId,
      cohortPartId: payload.cohortPartId,
      partName,
      applicantName: payload.name,
      interviewEndDate: payload.interviewEndDate,
    });
    return `${baseUrl}?token=${token}`;
  }
}
