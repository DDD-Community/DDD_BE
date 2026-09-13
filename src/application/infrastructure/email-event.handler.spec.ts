import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { CohortAnnouncementInfo } from '../../cohort/domain/cohort-announcement-info';
import { EMPTY_COHORT_ANNOUNCEMENT_INFO } from '../../cohort/domain/cohort-announcement-info';
import { InterviewBookingTokenService } from '../../interview/application/interview-booking-token.service';
import { NotificationService } from '../../notification/application/notification.service';
import { ApplicationStatus } from '../domain/application.status';
import { EmailEventHandler } from './email-event.handler';
import type {
  ApplicationStatusChangedEventPayload,
  ApplicationSubmittedEventPayload,
} from './email-event.type';

const BOOKING_URL = 'https://apply.example.com/interview/booking';
const LOGO_URL = 'https://admin.dddstudy.kr/logo.png';

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
    bankAccount: '국민은행 123-456-789',
    accountHolder: '홍길동',
    participationConfirmDeadline: '2026-09-28',
    documentResultDate: '2026-09-14',
  };

  const makeSubmittedPayload = (
    over: Partial<ApplicationSubmittedEventPayload> = {},
  ): ApplicationSubmittedEventPayload => ({
    email: 'applicant@example.com',
    name: '홍길동',
    partName: 'BE',
    // 2026-09-10 14:30 KST
    submittedAt: new Date('2026-09-10T05:30:00Z'),
    cohort: fullCohort,
    ...over,
  });

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

  const stubConfig = (values: Record<string, string | undefined>) =>
    configService.get.mockImplementation((key: string) => values[key]);

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
    stubConfig({ INTERVIEW_BOOKING_URL: BOOKING_URL });
  });

  describe('공용 레이아웃', () => {
    it('완성된 html 문서로 로고·제목·푸터를 갖춘다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload());

      const { html, text } = lastEmail();
      expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
      expect(html).toContain(`<img src="${LOGO_URL}" alt="DDD"`);
      expect(html).toContain('<title>서류 전형에 합격하셨습니다</title>');
      expect(html).toContain('문의사항은 본 메일로 회신해 주세요.');
      expect(text.endsWith('문의사항은 본 메일로 회신해 주세요.\n© DDD')).toBe(true);
    });
  });

  describe('handleApplicationSubmittedEvent', () => {
    it('기수·파트·접수 일시와 서류 발표일을 안내한다', async () => {
      await emailEventHandler.handleApplicationSubmittedEvent(makeSubmittedPayload());

      const { subject, text } = lastEmail();
      expect(subject).toBe('[DDD] 지원서 접수가 완료되었습니다');
      expect(text).toContain('홍길동님, 지원서가 정상적으로 접수되었습니다.');
      expect(text).toContain('- 지원 기수: DDD 14기');
      expect(text).toContain('- 지원 파트: BE');
      expect(text).toContain('- 접수 일시: 9월 10일(목) 오후 2:30');
      expect(text).toContain('서류 전형 결과는 9월 14일(월)부터 순차적으로 안내드립니다.');
    });

    it('발표일·기수 정보가 없으면 해당 줄을 생략하고 날짜 없는 안내로 바꾼다', async () => {
      await emailEventHandler.handleApplicationSubmittedEvent(
        makeSubmittedPayload({ cohort: EMPTY_COHORT_ANNOUNCEMENT_INFO, partName: null }),
      );

      const { text } = lastEmail();
      expect(text).not.toContain('지원 기수');
      expect(text).not.toContain('지원 파트');
      expect(text).toContain('- 접수 일시:');
      expect(text).toContain('서류 전형 결과는 추후 이메일로 안내드립니다.');
    });

    it('이름을 escape 처리해서 메일 본문에 포함한다', async () => {
      await emailEventHandler.handleApplicationSubmittedEvent(
        makeSubmittedPayload({ name: '<b>홍길동</b>' }),
      );

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
        emailEventHandler.handleApplicationSubmittedEvent(makeSubmittedPayload()),
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
      [ApplicationStatus.서류합격, '[DDD] 서류 전형에 합격하셨습니다'],
      [ApplicationStatus.서류불합격, '[DDD] 서류 전형 결과를 안내드립니다'],
      // 면접합격이 지원자에게 알리는 최종 합격 시점이다.
      [ApplicationStatus.면접합격, '[DDD] 14기 최종 합격을 축하드립니다'],
      [ApplicationStatus.최종불합격, '[DDD] 면접 전형 결과를 안내드립니다'],
    ])('%s 는 정해진 제목으로 메일을 보낸다', async (newStatus, subject) => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload({ newStatus }));

      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
      expect(lastEmail().subject).toBe(subject);
    });

    it('상태 변경 메일 본문도 escape 처리한다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ name: '<script>alert(1)</script>' }),
      );

      expect(lastEmail().html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(lastEmail().html).not.toContain('<script>alert(1)</script>');
    });

    describe('서류합격', () => {
      it('예약 버튼과 원문 주소, 파트·면접 방식을 안내한다', async () => {
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

        const link = `${BOOKING_URL}?token=signed-token`;
        const { html, text } = lastEmail();
        expect(html).toContain(`href="${link}"`);
        expect(html).toContain('면접 시간 예약하기');
        // 버튼이 막히는 클라이언트를 위해 원문 주소도 본문에 둔다.
        expect(html).toContain('버튼이 동작하지 않으면');
        expect(text).toContain('장원석님, 축하드립니다. 아래에서 면접 시간을 예약해 주세요.');
        expect(text).toContain('- 지원 파트: BE');
        expect(text).toContain('- 면접 방식: 온라인 (Google Meet)');
        expect(text).toContain(`면접 시간 예약하기: ${link}`);
        expect(text).toContain('예약 후에는 시간을 변경할 수 없습니다.');
      });

      it('예약 링크를 만들지 못하면 버튼과 예약 안내를 넣지 않는다', async () => {
        stubConfig({});

        await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload());

        expect(bookingTokenService.issue).not.toHaveBeenCalled();
        const { html, text } = lastEmail();
        expect(html).not.toContain('면접 시간 예약하기');
        expect(html).not.toContain('버튼이 동작하지 않으면');
        expect(text).not.toContain('아래에서 면접 시간을 예약해 주세요');
        expect(text).toContain('면접 일정은 운영진이 별도로 안내드립니다.');
      });

      it('기수 정보가 없어도(cohortId null) 합격 메일 자체는 발송한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ cohortId: null, cohort: EMPTY_COHORT_ANNOUNCEMENT_INFO }),
        );

        expect(bookingTokenService.issue).not.toHaveBeenCalled();
        expect(lastEmail().subject).toBe('[DDD] 서류 전형에 합격하셨습니다');
      });
    });

    describe('면접합격 (지원자에게 알리는 최종 합격)', () => {
      it('참가비·계좌·예금주·회신 기한과 회신 양식을 안내한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.면접합격, name: '김지원' }),
        );

        const { html, text } = lastEmail();
        expect(html).toContain('DDD 14기 최종 합격을 축하드립니다');
        expect(text).toContain('김지원님, 함께하실 의사가 있다면');
        expect(text).toContain('- 참가비: 50,000원');
        expect(text).toContain('- 입금 계좌: 국민은행 123-456-789');
        expect(text).toContain('- 예금주: 홍길동');
        expect(text).toContain('- 회신 기한: 9월 28일(월)');
        // 회신 양식 3줄이 text 에서도 줄바꿈으로 살아있어야 한다.
        expect(text).toContain(
          '회신 양식\n이름 / 지원 파트 / 입금자명\n참가 여부 : 참여합니다\n입금 완료 여부 : 완료',
        );
        expect(html).toContain('<strong>본 메일에 회신</strong>');
        expect(text).toContain('입금 후 위 양식대로 본 메일에 회신해 주세요.');
        expect(text).toContain('합격이 취소될 수 있습니다');
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

      it('기수 process 에 없는 항목은 해당 줄을 생략한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            newStatus: ApplicationStatus.면접합격,
            cohort: { ...fullCohort, participationFee: null, accountHolder: null },
          }),
        );

        const { text } = lastEmail();
        expect(text).not.toContain('- 참가비:');
        expect(text).not.toContain('- 예금주:');
        expect(text).toContain('- 입금 계좌: 국민은행 123-456-789');
      });

      it('안내 항목이 하나도 없으면 빈 정보 카드 없이 회신 양식부터 보인다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({
            newStatus: ApplicationStatus.면접합격,
            cohort: EMPTY_COHORT_ANNOUNCEMENT_INFO,
          }),
        );

        const { html, text } = lastEmail();
        expect(text).not.toContain('- ');
        expect(html).toContain('회신 양식');
        expect(lastEmail().subject).toBe('[DDD] 최종 합격을 축하드립니다');
      });
    });

    describe('불합격', () => {
      it('서류불합격 메일은 이름과 기수를 부르고 다음 기수 안내로 끝난다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.서류불합격 }),
        );

        const { text } = lastEmail();
        expect(text).toContain('홍길동님, DDD 14기에 지원해 주셔서 감사합니다.');
        expect(text).toContain('이번 서류 전형에서는 함께하지 못하게 되었습니다.');
        expect(text).toContain('다음 기수 소식은 DDD 홈페이지와 인스타그램에서 안내드립니다.');
      });

      it('최종불합격 메일은 면접 참여에 대한 감사로 시작한다', async () => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus: ApplicationStatus.최종불합격 }),
        );

        const { text } = lastEmail();
        expect(text).toContain('홍길동님, DDD 14기 면접에 참여해 주셔서 감사합니다.');
        expect(text).toContain('다음 기수 소식은 DDD 홈페이지와 인스타그램에서 안내드립니다.');
      });
    });
  });
});
