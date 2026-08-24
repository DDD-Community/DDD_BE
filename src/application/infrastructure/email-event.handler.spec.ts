import { Test } from '@nestjs/testing';

import { NotificationService } from '../../notification/application/notification.service';
import { ApplicationStatus } from '../domain/application.status';
import { EmailEventHandler } from './email-event.handler';

describe('EmailEventHandler', () => {
  let emailEventHandler: EmailEventHandler;
  const notificationService = {
    sendEmail: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EmailEventHandler,
        {
          provide: NotificationService,
          useValue: notificationService,
        },
      ],
    }).compile();

    emailEventHandler = module.get(EmailEventHandler);
    jest.clearAllMocks();
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
        await emailEventHandler.handleApplicationStatusChangedEvent({
          email: 'applicant@example.com',
          name: '홍길동',
          newStatus,
        });

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
      await emailEventHandler.handleApplicationStatusChangedEvent({
        email: 'applicant@example.com',
        name: '홍길동',
        newStatus,
      });

      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it('상태 변경 메일 본문도 escape 처리한다', async () => {
      await emailEventHandler.handleApplicationStatusChangedEvent({
        email: 'applicant@example.com',
        name: '<script>alert(1)</script>',
        newStatus: ApplicationStatus.서류합격,
      });

      expect(notificationService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'applicant@example.com',
          html: expect.stringContaining(
            '&lt;script&gt;alert(1)&lt;/script&gt;',
          ) as unknown as string,
        }),
      );
    });
  });
});
