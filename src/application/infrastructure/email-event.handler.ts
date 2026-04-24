import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { match } from 'ts-pattern';

import { NotificationService } from '../../notification/application/notification.service';
import { ApplicationStatus } from '../domain/application.status';
import type {
  ApplicationStatusChangedEventPayload,
  ApplicationSubmittedEventPayload,
  RenderedStatusEmailTemplate,
  StatusEmailTemplate,
} from './email-event.type';

@Injectable()
export class EmailEventHandler {
  private readonly logger = new Logger(EmailEventHandler.name);
  constructor(private readonly notificationService: NotificationService) {}

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
    this.logger.log(`[이메일 이벤트] 지원서 상태 변경 안내 메일 발송`);
    try {
      const template = this.buildStatusEmailTemplate({
        name: payload.name,
        newStatus: payload.newStatus,
      });

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

  private buildStatusEmailTemplate({
    name,
    newStatus,
  }: {
    name: string;
    newStatus: ApplicationStatus;
  }): RenderedStatusEmailTemplate {
    const safeName = this.escapeHtml(name);
    const templateByStatus = match(newStatus)
      .returnType<StatusEmailTemplate>()
      .with(ApplicationStatus.서류심사대기, () => ({
        subject: '[DDD] 지원 상태가 업데이트되었습니다.',
        message: '지원 상태가 변경되었습니다.',
      }))
      .with(ApplicationStatus.서류합격, () => ({
        subject: '[DDD] 서류전형 합격 안내',
        message: '서류전형에 합격하셨습니다.',
      }))
      .with(ApplicationStatus.서류불합격, () => ({
        subject: '[DDD] 서류전형 결과 안내',
        message: '아쉽게도 이번 서류전형에는 함께하지 못하게 되었습니다.',
      }))
      .with(ApplicationStatus.최종합격, () => ({
        subject: '[DDD] 최종 합격 안내',
        message: '최종 합격을 축하드립니다.',
      }))
      .with(ApplicationStatus.최종불합격, () => ({
        subject: '[DDD] 최종 결과 안내',
        message: '아쉽게도 이번 기수에서는 함께하지 못하게 되었습니다.',
      }))
      .with(ApplicationStatus.활동중, () => ({
        subject: '[DDD] 활동 시작 안내',
        message: '활동이 시작되었습니다. 함께하게 되어 기쁩니다.',
      }))
      .with(ApplicationStatus.활동완료, () => ({
        subject: '[DDD] 활동 종료 안내',
        message: '활동을 무사히 마치셨습니다. 함께해 주셔서 감사합니다.',
      }))
      .with(ApplicationStatus.활동중단, () => ({
        subject: '[DDD] 활동 중단 안내',
        message: '활동이 중단되었습니다.',
      }))
      .exhaustive();

    return {
      subject: templateByStatus.subject,
      html: this.wrapHtml(`
        <h2>${safeName}님, 안녕하세요.</h2>
        <p>${templateByStatus.message}</p>
      `),
      text: `${name}님, 안녕하세요.\n${templateByStatus.message}`,
    };
  }

  private wrapHtml(content: string): string {
    return `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111;">
        ${content}
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
