import { Test } from '@nestjs/testing';

import { EmailLogStatus } from '../domain/email-log.status';
import { NotificationRepository } from '../domain/notification.repository';
import { GmailEmailClient } from '../infrastructure/gmail-email.client';
import { NotificationService } from './notification.service';

const mockGmailEmailClient = {
  sendEmail: jest.fn(),
};

const mockNotificationRepository = {
  saveLog: jest.fn(),
};

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: GmailEmailClient, useValue: mockGmailEmailClient },
        { provide: NotificationRepository, useValue: mockNotificationRepository },
      ],
    }).compile();

    notificationService = module.get(NotificationService);
    jest.clearAllMocks();
  });

  const emailPayload = {
    to: 'test@example.com',
    subject: '[DDD] 테스트 메일',
    html: '<p>테스트</p>',
    text: '테스트',
  };

  describe('sendEmail', () => {
    it('발송 성공 시 SUCCESS 이력을 저장한다', async () => {
      // Given
      mockGmailEmailClient.sendEmail.mockResolvedValue(undefined);
      mockNotificationRepository.saveLog.mockResolvedValue(undefined);

      // When
      await notificationService.sendEmail(emailPayload);

      // Then
      expect(mockGmailEmailClient.sendEmail).toHaveBeenCalledWith(emailPayload);
      const saveCall = mockNotificationRepository.saveLog.mock.calls[0] as [
        { log: { recipientEmail: string; subject: string; status: EmailLogStatus } },
      ];
      expect(saveCall[0].log.recipientEmail).toBe('test@example.com');
      expect(saveCall[0].log.subject).toBe('[DDD] 테스트 메일');
      expect(saveCall[0].log.status).toBe(EmailLogStatus.SUCCESS);
    });

    it('발송 실패 시 FAILED 이력을 저장하고 예외를 던진다', async () => {
      // Given
      mockGmailEmailClient.sendEmail.mockRejectedValue(new Error('Gmail 전송 실패'));
      mockNotificationRepository.saveLog.mockResolvedValue(undefined);

      // When & Then
      await expect(notificationService.sendEmail(emailPayload)).rejects.toThrow('Gmail 전송 실패');

      const saveCall = mockNotificationRepository.saveLog.mock.calls[0] as [
        {
          log: {
            recipientEmail: string;
            subject: string;
            status: EmailLogStatus;
            errorMessage: string;
          };
        },
      ];
      expect(saveCall[0].log.recipientEmail).toBe('test@example.com');
      expect(saveCall[0].log.subject).toBe('[DDD] 테스트 메일');
      expect(saveCall[0].log.status).toBe(EmailLogStatus.FAILED);
      expect(saveCall[0].log.errorMessage).toBe('Gmail 전송 실패');
    });
  });
});
