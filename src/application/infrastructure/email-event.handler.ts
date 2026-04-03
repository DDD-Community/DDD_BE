import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { match } from 'ts-pattern';

import { ApplicationStatus } from '../domain/application.status';

@Injectable()
export class EmailEventHandler {
  private readonly logger = new Logger(EmailEventHandler.name);

  @OnEvent('application.submitted')
  handleApplicationSubmittedEvent(payload: { email: string; name: string }): void {
    this.logger.log(`[이메일 이벤트] 지원서 최종 제출 완료 안내 메일 발송`);
    this.logger.log(`수신: ${payload.email}, 이름: ${payload.name}`);
  }

  @OnEvent('application.status_changed')
  handleApplicationStatusChangedEvent(payload: {
    email: string;
    name: string;
    newStatus: ApplicationStatus;
  }): void {
    this.logger.log(`[이메일 이벤트] 지원서 상태 변경 안내 메일 발송`);
    this.logger.log(`수신: ${payload.email}, 변경 상태: ${payload.newStatus}`);

    match(payload.newStatus)
      .with(ApplicationStatus.서류합격, () => {
        this.logger.log('서류합격 안내 + 면접 예약 링크 포함 메일 발송');
      })
      .with(ApplicationStatus.서류불합격, () => {
        this.logger.log('서류불합격 안내 메일 발송');
      })
      .with(ApplicationStatus.최종합격, () => {
        this.logger.log('최종합격 안내 + 디스코드 링크 포함 메일 발송');
      })
      .with(ApplicationStatus.최종불합격, () => {
        this.logger.log('최종불합격 안내 메일 발송');
      })
      .with(ApplicationStatus.서류심사대기, () => {
        // 서류심사대기 상태로는 이벤트 발생하지 않음
      })
      .exhaustive();
  }
}
