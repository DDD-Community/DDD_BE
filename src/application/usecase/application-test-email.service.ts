import { HttpStatus, Injectable, Logger } from '@nestjs/common';

import { CohortService } from '../../cohort/application/cohort.service';
import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { toCohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { AppException } from '../../common/exception/app.exception';
import { maskEmail } from '../../common/util/mask-email';
import { NotificationService } from '../../notification/application/notification.service';
import type { AnnouncementStatus } from '../domain/application.status';
import { ANNOUNCEMENT_STATUS_BY_TEST_EMAIL_TYPE, TestEmailType } from '../domain/test-email.type';
import { EmailEventHandler } from '../infrastructure/email-event.handler';
import type { RenderedStatusEmailTemplate } from '../infrastructure/email-event.type';

/** 테스트 메일 본문에 들어가는 지원자 이름 */
const TEST_APPLICANT_NAME = '테스트';

/**
 * 테스트 발송에는 실제 지원서가 없다. 서류합격 메일의 예약 링크도 이 번호로 발급되는데,
 * 예약 단계에서 지원서를 행 잠금으로 다시 읽으므로(APPLICATION_NOT_FOUND) 슬롯이 잡히지 않는다.
 */
const TEST_APPLICATION_FORM_ID = 0;

@Injectable()
export class ApplicationTestEmailService {
  private readonly logger = new Logger(ApplicationTestEmailService.name);

  constructor(
    private readonly cohortService: CohortService,
    private readonly emailEventHandler: EmailEventHandler,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 기수의 현재 설정값으로 지원자 안내 메일을 만들어 요청한 운영진에게 보낸다.
   *
   * 메일 생성은 실제 발송 경로(EmailEventHandler)를 그대로 부른다. 수신자는 호출자 본인
   * 주소로 고정한다 — 임의 주소를 받으면 어드민 계정이 스팸 발송 창구가 된다.
   * 실제 발송과 달리 실패를 삼키지 않고 그대로 올린다. 운영진이 실패를 화면에서 알아야 한다.
   */
  async sendTestEmail({
    cohortId,
    type,
    to,
  }: {
    cohortId: number;
    type: TestEmailType;
    to: string;
  }): Promise<void> {
    const cohort = await this.cohortService.findCohortById({ id: cohortId });
    // 예약 링크와 "지원 파트" 줄에 쓸 파트. 열린 파트를 우선하고, 없으면 아무 파트나 쓴다.
    const part = cohort.parts?.find((p) => p.isOpen) ?? cohort.parts?.[0];
    if (!part) {
      throw new AppException('COHORT_PART_NOT_FOUND', HttpStatus.BAD_REQUEST);
    }

    const announcement = toCohortAnnouncementInfo({ name: cohort.name, process: cohort.process });
    const interviewEndDate = cohort.process?.interviewEndDate;

    const template: RenderedStatusEmailTemplate =
      type === TestEmailType.지원접수
        ? this.emailEventHandler.renderSubmittedEmail({
            email: to,
            name: TEST_APPLICANT_NAME,
            partName: part.partName,
            submittedAt: new Date(),
            cohort: announcement,
          })
        : this.renderAnnouncement({
            status: ANNOUNCEMENT_STATUS_BY_TEST_EMAIL_TYPE[type],
            to,
            cohortId: cohort.id,
            part,
            interviewEndDate: typeof interviewEndDate === 'string' ? interviewEndDate : null,
            announcement,
          });

    await this.notificationService.sendEmail({ to, ...template });
    this.logger.log(
      `테스트 메일 발송: cohortId=${cohortId}, type=${type}, to=${maskEmail({ email: to })}`,
    );
  }

  private renderAnnouncement({
    status,
    to,
    cohortId,
    part,
    interviewEndDate,
    announcement,
  }: {
    status: AnnouncementStatus;
    to: string;
    cohortId: number;
    part: { id: number; partName: string };
    interviewEndDate: string | null;
    announcement: CohortAnnouncementInfo;
  }): RenderedStatusEmailTemplate {
    return this.emailEventHandler.renderStatusEmail(
      {
        email: to,
        name: TEST_APPLICANT_NAME,
        newStatus: status,
        applicationFormId: TEST_APPLICATION_FORM_ID,
        cohortId,
        cohortPartId: part.id,
        partName: part.partName,
        interviewEndDate,
        cohort: announcement,
      },
      status,
    );
  }
}
