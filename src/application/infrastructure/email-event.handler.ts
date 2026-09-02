import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { match } from 'ts-pattern';

import { InterviewBookingTokenService } from '../../interview/application/interview-booking-token.service';
import { NotificationService } from '../../notification/application/notification.service';
import type { AnnouncementStatus } from '../domain/application.status';
import { ApplicationStatus, isAnnouncementStatus } from '../domain/application.status';
import type {
  ApplicationStatusChangedEventPayload,
  ApplicationSubmittedEventPayload,
  RenderedStatusEmailTemplate,
  StatusEmailTemplate,
} from './email-event.type';

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
      const safeName = this.escapeHtml(payload.name);
      return await this.notificationService.sendEmail({
        to: payload.email,
        subject: '[DDD] 지원서 접수가 완료되었습니다.',
        html: this.wrapHtml(`
          <h2>${safeName}님, 지원해 주셔서 감사합니다.</h2>
          <p>지원서가 정상적으로 접수되었습니다.</p>
          <p>심사 결과는 추후 이메일로 안내드립니다.</p>
        `),
        text: `${payload.name}님, 지원서가 정상적으로 접수되었습니다. 심사 결과는 추후 이메일로 안내드립니다.`,
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
    const safeName = this.escapeHtml(payload.name);
    const templateByStatus = match(newStatus)
      .returnType<StatusEmailTemplate>()
      .with(ApplicationStatus.서류합격, () => {
        const bookingLink = this.buildBookingLink(payload);
        return {
          subject: '[DDD] 서류전형 합격 안내',
          message: '서류전형에 합격하셨습니다.',
          extraHtml: bookingLink
            ? `
              <p>아래 버튼을 눌러 면접 시간을 예약해주세요. 예약 후에는 변경할 수 없으니 신중히 선택해주세요.</p>
              <p style="margin:24px 0;">
                <a href="${bookingLink}"
                   style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
                  면접 시간 예약하기
                </a>
              </p>
              <p style="color:#666;font-size:13px;">버튼이 동작하지 않으면 다음 링크를 브라우저에 붙여넣어주세요.<br/>${bookingLink}</p>
            `
            : '<p>면접 일정 안내는 추후 별도로 드릴 예정입니다.</p>',
          extraText: bookingLink
            ? `아래 링크에서 면접 시간을 예약해주세요. 예약 후에는 변경할 수 없습니다.\n${bookingLink}`
            : '면접 일정 안내는 추후 별도로 드릴 예정입니다.',
        };
      })
      .with(ApplicationStatus.서류불합격, () => ({
        subject: '[DDD] 서류전형 결과 안내',
        message: '아쉽게도 이번 서류전형에는 함께하지 못하게 되었습니다.',
      }))
      .with(ApplicationStatus.면접합격, () => ({
        subject: '[DDD] 면접전형 합격 안내',
        message: '면접전형에 합격하셨습니다. 최종 결과는 별도로 안내드립니다.',
      }))
      .with(ApplicationStatus.최종합격, () => ({
        subject: '[DDD] 최종 합격 안내',
        message: '최종 합격을 축하드립니다.',
      }))
      .with(ApplicationStatus.최종불합격, () => ({
        subject: '[DDD] 최종 결과 안내',
        message: '아쉽게도 이번 기수에서는 함께하지 못하게 되었습니다.',
      }))
      .exhaustive();

    return {
      subject: templateByStatus.subject,
      html: this.wrapHtml(`
        <h2>${safeName}님, 안녕하세요.</h2>
        <p>${templateByStatus.message}</p>
        ${templateByStatus.extraHtml ?? ''}
      `),
      text: [`${payload.name}님, 안녕하세요.`, templateByStatus.message, templateByStatus.extraText]
        .filter(Boolean)
        .join('\n'),
    };
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

  private wrapHtml(content: string): string {
    return `
      <div style="font-family:Arial,'Apple SD Gothic Neo',sans-serif;background:#f5f5f5;padding:24px 0;">
        <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
          <div style="background:#111;color:#fff;padding:20px 32px;font-size:18px;font-weight:bold;">DDD</div>
          <div style="padding:32px;line-height:1.7;color:#111;">${content}</div>
          <div style="padding:16px 32px;border-top:1px solid #eee;color:#999;font-size:12px;">
            본 메일은 발신 전용입니다. 문의는 DDD 운영진에게 부탁드립니다.
          </div>
        </div>
      </div>
    `;
  }

  private escapeHtml(input: string): string {
    const escapedAmpersand = input.replaceAll('&', '&amp;');
    const escapedLessThan = escapedAmpersand.replaceAll('<', '&lt;');
    const escapedGreaterThan = escapedLessThan.replaceAll('>', '&gt;');
    const escapedDoubleQuote = escapedGreaterThan.replaceAll('"', '&quot;');
    return escapedDoubleQuote.replaceAll("'", '&#39;');
  }
}
