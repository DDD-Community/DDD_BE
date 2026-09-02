import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { match } from 'ts-pattern';

import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { InterviewBookingTokenService } from '../../interview/application/interview-booking-token.service';
import { NotificationService } from '../../notification/application/notification.service';
import type { EmailBullet } from '../../notification/util/build-email';
import { buildEmail } from '../../notification/util/build-email';
import { formatKoreanDeadline } from '../../notification/util/format-korean-date';
import type { AnnouncementStatus } from '../domain/application.status';
import { ApplicationStatus, isAnnouncementStatus } from '../domain/application.status';
import type {
  ApplicationStatusChangedEventPayload,
  ApplicationSubmittedEventPayload,
  RenderedStatusEmailTemplate,
} from './email-event.type';

const ONLINE_INTERVIEW = '온라인 인터뷰(Google Meet)';

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
      const { html, text } = buildEmail({
        title: '지원서 접수가 완료되었습니다',
        greetingHtml: `안녕하세요, ${this.escapeHtml(payload.name)}님. DDD 운영진입니다.`,
        greetingText: `안녕하세요, ${payload.name}님. DDD 운영진입니다.`,
        introParagraphs: [
          '지원서가 정상적으로 접수되었습니다.',
          '심사 결과는 추후 이메일로 안내드리겠습니다.',
        ],
        outroParagraphs: ['지원해 주셔서 감사합니다.'],
      });

      return await this.notificationService.sendEmail({
        to: payload.email,
        subject: '[DDD] 지원서 접수가 완료되었습니다.',
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
    return cohort.name ? `DDD ${this.escapeHtml(cohort.name)}` : 'DDD';
  }

  private buildDocumentPassEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const { cohort } = payload;
    const bookingLink = this.buildBookingLink(payload);
    const label = this.cohortLabel(cohort);

    const bullets: EmailBullet[] = [];
    if (bookingLink) {
      bullets.push({
        label: '인터뷰 일정 선택 링크',
        valueHtml: `<a href="${this.escapeHtml(bookingLink)}" style="color:#1a56db;text-decoration:underline;word-break:break-all;">일정 선택하기</a>`,
        valueText: bookingLink,
      });
    }
    if (cohort.slotSelectionDeadline) {
      const deadline = formatKoreanDeadline(cohort.slotSelectionDeadline);
      bullets.push({
        label: '선택 기한',
        valueHtml: `${this.escapeHtml(deadline)}까지`,
        valueText: `${deadline}까지`,
      });
    }
    bullets.push({
      label: '진행 방식',
      valueHtml: ONLINE_INTERVIEW,
      valueText: ONLINE_INTERVIEW,
    });
    if (cohort.interviewDurationMinutes) {
      const duration = `약 ${cohort.interviewDurationMinutes}분`;
      bullets.push({ label: '예상 소요 시간', valueHtml: duration, valueText: duration });
    }

    const safeName = this.escapeHtml(payload.name);
    const outroParagraphs = [
      '인터뷰 일정은 선착순으로 마감되므로, 가능한 시간대를 확인하신 후 기한 내 선택해 주시기 바랍니다.',
      '일정 선택이 완료되면 확정된 시간과 Google Meet 링크를 별도 메일로 안내드리겠습니다.',
    ];
    if (!bookingLink) {
      // 링크를 만들지 못했으면 "아래 링크에서 선택하라"는 안내가 거짓말이 된다.
      outroParagraphs.splice(0, 2, '인터뷰 일정 안내는 운영진이 별도로 드릴 예정입니다.');
    }

    const { html, text } = buildEmail({
      title: '서류 합격 및 면접 일정 선택 안내',
      greetingHtml: `안녕하세요, ${safeName}님. DDD 운영진입니다.`,
      greetingText: `안녕하세요, ${payload.name}님. DDD 운영진입니다.`,
      introParagraphs: [
        `${label}에 지원해 주셔서 감사드리며, 서류 전형 합격을 진심으로 축하드립니다.`,
        bookingLink
          ? '다음 전형인 온라인 인터뷰 진행을 위해 아래 링크에서 가능한 일정을 선택해 주세요.'
          : '다음 전형은 온라인 인터뷰로 진행됩니다.',
      ],
      bullets,
      outroParagraphs: [
        ...outroParagraphs,
        `인터뷰를 통해 ${safeName}님의 경험과 생각을 더 자세히 들을 수 있기를 기대하겠습니다.`,
      ],
    });

    return { subject: '[DDD] 서류 합격 및 면접 일정 선택 안내', html, text };
  }

  private buildDocumentFailEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const { html, text } = buildEmail({
      title: '서류 전형 결과 안내',
      greetingHtml: '안녕하세요, DDD 운영진입니다.',
      greetingText: '안녕하세요, DDD 운영진입니다.',
      introParagraphs: [
        `${this.cohortLabel(payload.cohort)}에 지원해 주셔서 감사합니다.`,
        '제한된 모집 인원으로 인해 모든 지원자분과 함께하지 못하게 되어, 아쉽게도 이번 서류 전형에서는 모시지 못하게 되었습니다.',
      ],
      outroParagraphs: [
        '소중한 시간 내어 지원해 주신 점 감사드리며, 앞으로의 활동을 응원하겠습니다.',
      ],
    });

    return { subject: '[DDD] 서류 전형 결과 안내', html, text };
  }

  private buildInterviewFailEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const { html, text } = buildEmail({
      title: '면접 전형 결과 안내',
      greetingHtml: '안녕하세요, DDD 운영진입니다.',
      greetingText: '안녕하세요, DDD 운영진입니다.',
      introParagraphs: [
        `${this.cohortLabel(payload.cohort)} 면접에 참여해 주셔서 감사합니다.`,
        '제한된 모집 인원 안에서 신중하게 논의한 결과, 아쉽게도 이번 기수에서는 함께하지 못하게 되었습니다.',
      ],
      outroParagraphs: [
        '귀한 시간 내어 지원과 면접에 참여해 주신 점 감사드리며, 앞으로의 활동을 응원하겠습니다.',
      ],
    });

    return { subject: '[DDD] 면접 전형 결과 안내', html, text };
  }

  private buildFinalPassEmail(
    payload: ApplicationStatusChangedEventPayload,
  ): RenderedStatusEmailTemplate {
    const { cohort } = payload;
    const safeName = this.escapeHtml(payload.name);
    const label = this.cohortLabel(cohort);
    const depositorName = payload.partName ? `${payload.name}_${payload.partName}` : payload.name;

    const bullets: EmailBullet[] = [];
    if (cohort.participationFee !== null) {
      const fee = `${cohort.participationFee.toLocaleString('ko-KR')}원`;
      bullets.push({ label: '참가비', valueHtml: fee, valueText: fee });
    }
    if (cohort.bankAccount) {
      bullets.push({
        label: '입금 계좌',
        valueHtml: this.escapeHtml(cohort.bankAccount),
        valueText: cohort.bankAccount,
      });
    }
    bullets.push({
      label: '입금자명',
      valueHtml: this.escapeHtml(depositorName),
      valueText: depositorName,
    });
    if (cohort.participationConfirmDeadline) {
      const deadline = formatKoreanDeadline(cohort.participationConfirmDeadline);
      bullets.push({
        label: '입금 및 회신 기한',
        valueHtml: `${this.escapeHtml(deadline)}까지`,
        valueText: `${deadline}까지`,
      });
    }

    const replyFormat = [
      '참가비 입금 후, 아래 양식에 맞춰 본 메일로 회신 부탁드립니다.',
      '1. 이름:<br/>2. 지원 파트:<br/>3. 참가 여부: 참여합니다.<br/>4. 입금자명:<br/>5. 입금 완료 여부: 완료',
    ];

    const { html, text } = buildEmail({
      title: '최종 합격 및 참가 안내',
      greetingHtml: `안녕하세요, ${safeName}님. DDD 운영진입니다.`,
      greetingText: `안녕하세요, ${payload.name}님. DDD 운영진입니다.`,
      introParagraphs: [
        `${label}에 최종 합격하신 것을 진심으로 축하드립니다!`,
        'DDD와 함께할 의사가 있으신 경우, 아래 내용을 확인하신 후 기한 내 참가비 입금 및 참여 의사를 회신해 주세요.',
      ],
      bullets,
      outroParagraphs: [
        ...replyFormat,
        '기한 내 입금 및 회신이 확인되지 않을 경우 참여 의사가 없는 것으로 간주되어, 합격이 취소될 수 있습니다. 부득이한 사정이 있다면 반드시 기한 전에 회신해 주세요.',
        `앞으로 ${label}에서 함께 좋은 경험을 만들어가기를 기대하겠습니다. 다시 한번 최종 합격을 축하드립니다.`,
      ],
    });

    return { subject: '[DDD] 최종 합격 및 참가 안내', html, text };
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

  private escapeHtml(input: string): string {
    const escapedAmpersand = input.replaceAll('&', '&amp;');
    const escapedLessThan = escapedAmpersand.replaceAll('<', '&lt;');
    const escapedGreaterThan = escapedLessThan.replaceAll('>', '&gt;');
    const escapedDoubleQuote = escapedGreaterThan.replaceAll('"', '&quot;');
    return escapedDoubleQuote.replaceAll("'", '&#39;');
  }
}
