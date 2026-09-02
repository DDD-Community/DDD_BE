import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { EMPTY_COHORT_ANNOUNCEMENT_INFO } from '../../cohort/domain/cohort-announcement-info';
import { InterviewBookingTokenService } from '../../interview/application/interview-booking-token.service';
import { NotificationService } from '../../notification/application/notification.service';
import { ApplicationStatus } from '../domain/application.status';
import { EmailEventHandler } from './email-event.handler';
import type { ApplicationStatusChangedEventPayload } from './email-event.type';

describe('EmailEventHandler', () => {
  let emailEventHandler: EmailEventHandler;
  const notificationService = {
    sendEmail: jest.fn(),
  };
  const bookingTokenService = {
    issue: jest.fn().mockReturnValue('signed-token'),
  };
  const configService = {
    get: jest.fn(),
  };

  const fullCohort: CohortAnnouncementInfo = {
    name: '14기',
    slotSelectionDeadline: '2026-09-18',
    interviewDurationMinutes: 30,
    interviewRescheduleDeadline: '2026-09-18',
    participationFee: 50000,
    bankAccount: '국민은행 / 123-456-789 / 홍길동',
    participationConfirmDeadline: '2026-09-28',
  };

  const makeStatusPayload = (
    over: Partial<ApplicationStatusChangedEventPayload> = {},
  ): ApplicationStatusChangedEventPayload => ({
    email: 'applicant@example.com',
    name: '홍길동',
    newStatus: ApplicationStatus.서류합격,
    applicationFormId: 123,
    cohortId: 12,
    cohortPartId: 52,
    partName: 'BE',
    interviewEndDate: '2026-09-20',
    cohort: fullCohort,
    ...over,
  });

  const lastEmail = () =>
    notificationService.sendEmail.mock.calls[0][0] as {
      subject: string;
      html: string;
      text: string;
    };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailEventHandler,
        { provide: NotificationService, useValue: notificationService },
        { provide: InterviewBookingTokenService, useValue: bookingTokenService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    emailEventHandler = module.get(EmailEventHandler);
    jest.clearAllMocks();
    bookingTokenService.issue.mockReturnValue('signed-token');
    configService.get.mockReturnValue('https://apply.example.com/interview/booking');
  });

  describe('handleApplicationSubmittedEvent', () => {
    it('이름을 escape 처리해서 메일 본문에 포함한다', async () => {
      await emailEventHandler.handleApplicationSubmittedEvent({
        email: 'applicant@example.com',
        name: '<b>홍길동</b>',
      });

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@example.com',
          html: expect.stringContaining('&lt;b&gt;홍길동&lt;/b&gt;') as unknown as string,
        }),
      );
    });

    it('메일 발송 실패 시 예외를 외부로 던지지 않는다', async () => {
      notificationService.sendEmail.mockRejectedValueOnce(new Error('send failure'));

      await expect(
        emailEventHandler.handleApplicationSubmittedEvent({
          email: 'applicant@example.com',
          name: '홍길동',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('handleApplicationStatusChangedEvent', () => {
    it.each([
      // 최종합격은 운영진이 입금을 확인해 올리는 내부 단계다. 지원자에게 알리는 합격·입금
      // 안내는 이미 면접합격 시점에 나갔으므로 여기서 또 보내면 중복이다.
      ApplicationStatus.최종합격,
      ApplicationStatus.활동중,
      ApplicationStatus.활동완료,
      ApplicationStatus.활동중단,
    ])('%s 로 바뀌면 메일을 보내지 않는다', async (newStatus) => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload({ newStatus }));

      expect(notificationService.sendEmail).not.toHaveBeenCalled();
    });

    it.each([
      [ApplicationStatus.서류합격, '[DDD] 서류 합격 및 면접 일정 선택 안내'],
      [ApplicationStatus.서류불합격, '[DDD] 서류 전형 결과 안내'],
      // 면접합격이 지원자에게 알리는 최종 합격 시점이다.
      [ApplicationStatus.면접합격, '[DDD] 최종 합격 및 참가 안내'],
      [ApplicationStatus.최종불합격, '[DDD] 면접 전형 결과 안내'],
    ])('%s 는 정해진 제목으로 메일을 보낸다', async (newStatus, subject) => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload({ newStatus }));

      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
      expect(lastEmail().subject).toBe(subject);
    });

    it('모든 안내 메일은 운영진 서명으로 끝난다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload());

      expect(lastEmail().html).toContain('DDD 운영진 드림');
      expect(lastEmail().text).toContain('DDD 운영진 드림');
    });

    it('상태 변경 메일 본문도 escape 처리한다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ name: '<script>alert(1)</script>' }),
      );

      expect(lastEmail().html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(lastEmail().html).not.toContain('<script>alert(1)</script>');
    });

    describe('서류합격', () => {
      it('예약 링크와 기수·기한·소요시간을 함께 안내한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ name: '장원석' }),
        );

        expect(bookingTokenService.issue).toHaveBeenCalledWith({
          applicationFormId: 123,
          cohortId: 12,
          cohortPartId: 52,
          partName: 'BE',
          applicantName: '장원석',
          interviewEndDate: '2026-09-20',
        });

        const { html, text } = lastEmail();
        expect(html).toContain('https://apply.example.com/interview/booking?token=signed-token');
        expect(text).toContain('?token=signed-token');
        expect(html).toContain('DDD 14기');
        expect(html).toContain('9월 18일');
        expect(html).toContain('약 30분');
        expect(html).toContain('온라인 인터뷰(Google Meet)');
        expect(html).toContain('선착순');
      });

      it('기한·소요시간이 비어 있으면 해당 줄만 생략하고 발송한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            cohort: { ...fullCohort, slotSelectionDeadline: null, interviewDurationMinutes: null },
          }),
        );

        const { html } = lastEmail();
        expect(html).not.toContain('선택 기한');
        expect(html).not.toContain('예상 소요 시간');
        expect(html).toContain('온라인 인터뷰(Google Meet)');
      });

      it('예약 링크를 만들지 못하면 링크 안내 문구를 넣지 않는다', async () => {
        configService.get.mockReturnValue(undefined);

        await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload());

        expect(bookingTokenService.issue).not.toHaveBeenCalled();
        const { html } = lastEmail();
        expect(html).not.toContain('아래 링크에서');
        expect(html).toContain('운영진이 별도로 드릴 예정입니다');
      });

      it('기수 정보가 없어도(cohortId null) 합격 메일 자체는 발송한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ cohortId: null, cohort: EMPTY_COHORT_ANNOUNCEMENT_INFO }),
        );

        expect(bookingTokenService.issue).not.toHaveBeenCalled();
        expect(lastEmail().subject).toBe('[DDD] 서류 합격 및 면접 일정 선택 안내');
      });
    });

    describe('면접합격 (지원자에게 알리는 최종 합격)', () => {
      it('참가비·계좌·기한과 입금자명(이름_파트)을 안내한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.면접합격, name: '홍길동' }),
        );

        const { html, text } = lastEmail();
        expect(html).toContain('50,000원');
        expect(html).toContain('국민은행 / 123-456-789 / 홍길동');
        expect(html).toContain('홍길동_BE');
        expect(html).toContain('9월 28일');
        expect(html).toContain('합격이 취소될 수 있습니다');
        expect(text).toContain('홍길동_BE');
        // 회신 양식 5줄이 text 에서도 줄바꿈으로 살아있어야 한다.
        expect(text).toContain('1. 이름:\n2. 지원 파트:');
        expect(text).toContain('5. 입금 완료 여부: 완료');
      });

      it('기수명이 html 에 escape 되고 text 는 원문으로 복원된다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            newStatus: ApplicationStatus.면접합격,
            cohort: { ...fullCohort, name: '14기<img src=x onerror=alert(1)>' },
          }),
        );

        const { html, text } = lastEmail();
        expect(html).not.toContain('<img src=x');
        expect(html).toContain('&lt;img src=x');
        expect(text).toContain('14기<img src=x onerror=alert(1)>');
      });

      it('참가비 정보가 비어 있으면 해당 줄을 생략한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            newStatus: ApplicationStatus.면접합격,
            cohort: { ...fullCohort, participationFee: null, bankAccount: null },
          }),
        );

        // '참가비'·'입금 계좌' 는 본문 문장에도 나오는 단어라, 항목 값으로 확인한다.
        const { html } = lastEmail();
        expect(html).not.toContain('50,000원');
        expect(html).not.toContain('국민은행');
        expect(html).toContain('입금자명');
      });

      it('파트 정보가 없으면 입금자명에 이름만 넣는다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            newStatus: ApplicationStatus.면접합격,
            name: '홍길동',
            partName: null,
          }),
        );

        expect(lastEmail().html).toContain('홍길동');
        expect(lastEmail().html).not.toContain('홍길동_');
      });
    });

    describe('불합격', () => {
      it('서류불합격 메일은 지원자 이름 없이 기수만 언급한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.서류불합격 }),
        );

        const { html } = lastEmail();
        expect(html).toContain('안녕하세요, DDD 운영진입니다.');
        expect(html).toContain('DDD 14기에 지원해 주셔서 감사합니다.');
        expect(html).toContain('앞으로의 활동을 응원하겠습니다');
      });

      it('최종불합격 메일은 면접 참여에 대한 감사로 시작한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.최종불합격 }),
        );

        expect(lastEmail().html).toContain('DDD 14기 면접에 참여해 주셔서 감사합니다.');
      });
    });
  });
});
