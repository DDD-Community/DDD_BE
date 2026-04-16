import { Test } from '@nestjs/testing';

import { EmailLogStatus } from '../domain/email-log.status';
import { EmailLogWriteRepository } from '../infrastructure/email-log.write.repository';
import { ResendEmailClient } from '../infrastructure/resend-email.client';
import { NotificationService } from './notification.service';

const mockResendEmailClient = {
  sendEmail: jest.fn(),
};

const mockEmailLogWriteRepository = {
  save: jest.fn(),
};

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationService,
        { provide: ResendEmailClient, useValue: mockResendEmailClient },
        { provide: EmailLogWriteRepository, useValue: mockEmailLogWriteRepository },
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
      mockResendEmailClient.sendEmail.mockResolvedValue(undefined);
      mockEmailLogWriteRepository.save.mockResolvedValue(undefined);

      // When
      await notificationService.sendEmail(emailPayload);

      // Then
      expect(mockResendEmailClient.sendEmail).toHaveBeenCalledWith(emailPayload);
      expect(mockEmailLogWriteRepository.save).toHaveBeenCalledWith({
        log: expect.objectContaining({
          recipientEmail: 'test@example.com',
          subject: '[DDD] 테스트 메일',
          status: EmailLogStatus.SUCCESS,
        }),
      });
    });

    it('발송 실패 시 FAILED 이력을 저장하고 예외를 던진다', async () => {
      // Given
      mockResendEmailClient.sendEmail.mockRejectedValue(new Error('Resend 전송 실패'));
      mockEmailLogWriteRepository.save.mockResolvedValue(undefined);

      // When & Then
      await expect(notificationService.sendEmail(emailPayload)).rejects.toThrow('Resend 전송 실패');

      expect(mockEmailLogWriteRepository.save).toHaveBeenCalledWith({
        log: expect.objectContaining({
          recipientEmail: 'test@example.com',
          subject: '[DDD] 테스트 메일',
          status: EmailLogStatus.FAILED,
          errorMessage: 'Resend 전송 실패',
        }),
      });
    });
  });
});
