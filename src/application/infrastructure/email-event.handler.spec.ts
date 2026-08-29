import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

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
    ...over,
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailEventHandler,
        {
          provide: NotificationService,
          useValue: notificationService,
        },
        {
          provide: InterviewBookingTokenService,
          useValue: bookingTokenService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
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
    it.each([ApplicationStatus.활동중, ApplicationStatus.활동완료, ApplicationStatus.활동중단])(
      '%s 로 바뀌면 메일을 보내지 않는다',
      async (newStatus) => {
        await emailEventHandler.handleApplicationStatusChangedEvent(
          makeStatusPayload({ newStatus }),
        );

        expect(notificationService.sendEmail).not.toHaveBeenCalled();
      },
    );

    it.each([
      ApplicationStatus.서류합격,
      ApplicationStatus.서류불합격,
      ApplicationStatus.면접합격,
      ApplicationStatus.최종합격,
      ApplicationStatus.최종불합격,
    ])('%s 는 전형 결과라 메일을 보낸다', async (newStatus) => {
      await emailEventHandler.handleApplicationStatusChangedEvent(makeStatusPayload({ newStatus }));

      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('면접합격 메일은 최종 결과가 따로 안내된다고 알린다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ newStatus: ApplicationStatus.면접합격 }),
      );

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: '[DDD] 면접전형 합격 안내',
          html: expect.stringContaining('최종 결과는 별도로 안내드립니다') as unknown as string,
        }),
      );
    });

    it('상태 변경 메일 본문도 escape 처리한다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ name: '<script>alert(1)</script>' }),
      );

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@example.com',
          html: expect.stringContaining(
            '&lt;script&gt;alert(1)&lt;/script&gt;',
          ) as unknown as string,
        }),
      );
    });

    it('서류합격 메일에 예약 링크 CTA 를 포함한다', async () => {
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
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.stringContaining(
            'https://apply.example.com/interview/booking?token=signed-token',
          ) as unknown as string,
          text: expect.stringContaining('?token=signed-token') as unknown as string,
        }),
      );
    });

    it('INTERVIEW_BOOKING_URL 미설정이면 링크 없이 발송한다', async () => {
      configService.get.mockReturnValue(undefined);

      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ interviewEndDate: null }),
      );

      expect(bookingTokenService.issue).not.toHaveBeenCalled();
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: '[DDD] 서류전형 합격 안내' }),
      );
    });

    it('서류합격이 아닌 발표 상태는 예약 링크를 만들지 않는다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent(
        makeStatusPayload({ newStatus: ApplicationStatus.최종합격 }),
      );

      expect(bookingTokenService.issue).not.toHaveBeenCalled();
      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          html: expect.not.stringContaining('?token=') as unknown as string,
        }),
      );
    });
  });
});
