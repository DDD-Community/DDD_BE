jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { AppException } from '../../common/exception/app.exception';
import { NotificationCampaignRepository } from '../domain/notification-campaign.repository';
import { NotificationCampaignStatus } from '../domain/notification-campaign.status';
import { EarlyNotificationService } from './early-notification.service';
import { NotificationCampaignService } from './notification-campaign.service';

const mockNotificationCampaignRepository = {
  register: jest.fn(),
  findById: jest.fn(),
  findByCohort: jest.fn(),
  findDueScheduled: jest.fn(),
  transitionStatus: jest.fn(),
};

const mockCohortRepository = {
  findById: jest.fn(),
};

const mockEarlyNotificationService = {
  sendBulk: jest.fn(),
};

const mockAuditLogService = {
  recordStatusChange: jest.fn(),
};

describe('NotificationCampaignService', () => {
  let service: NotificationCampaignService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationCampaignService,
        {
          provide: NotificationCampaignRepository,
          useValue: mockNotificationCampaignRepository,
        },
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: EarlyNotificationService, useValue: mockEarlyNotificationService },
        { provide: AuditLogService, useValue: mockAuditLogService },
      ],
    }).compile();

    service = moduleRef.get(NotificationCampaignService);
    jest.clearAllMocks();
  });

  describe('createCampaign', () => {
    const payload = {
      cohortId: 1,
      scheduledAt: new Date('2026-06-01T10:00:00Z'),
      subject: '제목',
      html: '<p>본문</p>',
      text: '본문',
    };

    it('대상 기수가 없으면 COHORT_NOT_FOUND를 던진다', async () => {
      // Given
      mockCohortRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.createCampaign(payload)).rejects.toThrow(
        new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockNotificationCampaignRepository.register).not.toHaveBeenCalled();
    });

    it('대상 기수가 있으면 캠페인을 등록하고 반환한다', async () => {
      // Given
      const created = { id: 10, ...payload, status: NotificationCampaignStatus.SCHEDULED };
      mockCohortRepository.findById.mockResolvedValue({ id: 1 });
      mockNotificationCampaignRepository.register.mockResolvedValue(created);

      // When
      const result = await service.createCampaign(payload);

      // Then
      expect(result).toBe(created);
      expect(mockNotificationCampaignRepository.register).toHaveBeenCalledWith(payload);
    });
  });

  describe('pauseCampaign', () => {
    it('캠페인이 없으면 NOTIFICATION_CAMPAIGN_NOT_FOUND를 던진다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(service.pauseCampaign({ id: 5 })).rejects.toThrow(
        new AppException('NOTIFICATION_CAMPAIGN_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
    });

    it('SCHEDULED 상태가 아니면 INVALID_STATE를 던진다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue({
        id: 5,
        status: NotificationCampaignStatus.RUNNING,
      });

      // When & Then
      await expect(service.pauseCampaign({ id: 5 })).rejects.toThrow(
        new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT),
      );
      expect(mockNotificationCampaignRepository.transitionStatus).not.toHaveBeenCalled();
    });

    it('SCHEDULED 상태면 PAUSED로 전이하고 audit 로그를 남긴다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue({
        id: 5,
        status: NotificationCampaignStatus.SCHEDULED,
      });
      mockNotificationCampaignRepository.transitionStatus.mockResolvedValue(true);

      // When
      await service.pauseCampaign({ id: 5 });

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenCalledWith({
        id: 5,
        fromStatus: NotificationCampaignStatus.SCHEDULED,
        toStatus: NotificationCampaignStatus.PAUSED,
      });
      expect(mockAuditLogService.recordStatusChange).toHaveBeenCalledWith({
        entityType: 'notification_campaign',
        entityId: 5,
        fromValue: NotificationCampaignStatus.SCHEDULED,
        toValue: NotificationCampaignStatus.PAUSED,
        adminId: 0,
      });
    });

    it('상태 전이가 race로 실패하면 INVALID_STATE를 던진다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue({
        id: 5,
        status: NotificationCampaignStatus.SCHEDULED,
      });
      mockNotificationCampaignRepository.transitionStatus.mockResolvedValue(false);

      // When & Then
      await expect(service.pauseCampaign({ id: 5 })).rejects.toThrow(
        new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT),
      );
      expect(mockAuditLogService.recordStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('resumeCampaign', () => {
    it('PAUSED 상태가 아니면 INVALID_STATE를 던진다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue({
        id: 5,
        status: NotificationCampaignStatus.SCHEDULED,
      });

      // When & Then
      await expect(service.resumeCampaign({ id: 5 })).rejects.toThrow(
        new AppException('NOTIFICATION_CAMPAIGN_INVALID_STATE', HttpStatus.CONFLICT),
      );
    });

    it('PAUSED 상태면 SCHEDULED로 복귀하고 audit 로그를 남긴다', async () => {
      // Given
      mockNotificationCampaignRepository.findById.mockResolvedValue({
        id: 5,
        status: NotificationCampaignStatus.PAUSED,
      });
      mockNotificationCampaignRepository.transitionStatus.mockResolvedValue(true);

      // When
      await service.resumeCampaign({ id: 5 });

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenCalledWith({
        id: 5,
        fromStatus: NotificationCampaignStatus.PAUSED,
        toStatus: NotificationCampaignStatus.SCHEDULED,
      });
      expect(mockAuditLogService.recordStatusChange).toHaveBeenCalledWith({
        entityType: 'notification_campaign',
        entityId: 5,
        fromValue: NotificationCampaignStatus.PAUSED,
        toValue: NotificationCampaignStatus.SCHEDULED,
        adminId: 0,
      });
    });
  });

  describe('runDueCampaigns / executeCampaign', () => {
    const baseCampaign = {
      id: 100,
      cohortId: 1,
      subject: '제목',
      html: '<p>본문</p>',
      text: '본문',
      scheduledAt: new Date('2026-06-01T10:00:00Z'),
      status: NotificationCampaignStatus.SCHEDULED,
    };

    it('due 캠페인이 없으면 추가 호출이 없다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([]);

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).not.toHaveBeenCalled();
      expect(mockEarlyNotificationService.sendBulk).not.toHaveBeenCalled();
    });

    it('claim 실패 시 sendBulk를 호출하지 않고 다음으로 넘어간다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus.mockResolvedValueOnce(false);

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockEarlyNotificationService.sendBulk).not.toHaveBeenCalled();
      expect(mockAuditLogService.recordStatusChange).not.toHaveBeenCalled();
    });

    it('전송 성공(success>0) 시 RUNNING→DONE 전이 + audit', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockEarlyNotificationService.sendBulk.mockResolvedValue({ total: 3, success: 3, failed: 0 });

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenNthCalledWith(1, {
        id: 100,
        fromStatus: NotificationCampaignStatus.SCHEDULED,
        toStatus: NotificationCampaignStatus.RUNNING,
      });
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenNthCalledWith(2, {
        id: 100,
        fromStatus: NotificationCampaignStatus.RUNNING,
        toStatus: NotificationCampaignStatus.DONE,
        patch: {
          sentAt: expect.any(Date) as unknown,
          result: { total: 3, success: 3, failed: 0 },
        },
      });
      expect(mockAuditLogService.recordStatusChange).toHaveBeenCalledWith({
        entityType: 'notification_campaign',
        entityId: 100,
        fromValue: NotificationCampaignStatus.RUNNING,
        toValue: NotificationCampaignStatus.DONE,
        adminId: 0,
      });
    });

    it('대상이 없을 때(total=0)는 DONE으로 종료한다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockEarlyNotificationService.sendBulk.mockResolvedValue({ total: 0, success: 0, failed: 0 });

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenNthCalledWith(2, {
        id: 100,
        fromStatus: NotificationCampaignStatus.RUNNING,
        toStatus: NotificationCampaignStatus.DONE,
        patch: {
          sentAt: expect.any(Date) as unknown,
          result: { total: 0, success: 0, failed: 0 },
        },
      });
    });

    it('전부 실패(success=0, total>0)면 FAILED로 종료한다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockEarlyNotificationService.sendBulk.mockResolvedValue({ total: 2, success: 0, failed: 2 });

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenNthCalledWith(2, {
        id: 100,
        fromStatus: NotificationCampaignStatus.RUNNING,
        toStatus: NotificationCampaignStatus.FAILED,
        patch: {
          sentAt: expect.any(Date) as unknown,
          result: { total: 2, success: 0, failed: 2 },
        },
      });
    });

    it('sendBulk 자체가 throw하면 FAILED로 종료하고 result는 null로 둔다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      mockEarlyNotificationService.sendBulk.mockRejectedValue(new Error('SMTP down'));

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockNotificationCampaignRepository.transitionStatus).toHaveBeenNthCalledWith(2, {
        id: 100,
        fromStatus: NotificationCampaignStatus.RUNNING,
        toStatus: NotificationCampaignStatus.FAILED,
        patch: { sentAt: expect.any(Date) as unknown, result: null },
      });
    });

    it('finalize 단계의 transitionStatus가 실패하면 audit 로그를 남기지 않는다', async () => {
      // Given
      mockNotificationCampaignRepository.findDueScheduled.mockResolvedValue([baseCampaign]);
      mockNotificationCampaignRepository.transitionStatus
        .mockResolvedValueOnce(true) // claim 성공
        .mockResolvedValueOnce(false); // finalize 실패
      mockEarlyNotificationService.sendBulk.mockResolvedValue({ total: 1, success: 1, failed: 0 });

      // When
      await service.runDueCampaigns();

      // Then
      expect(mockAuditLogService.recordStatusChange).not.toHaveBeenCalled();
    });
  });

  describe('listByCohort', () => {
    it('cohortId/status를 그대로 위임한다', async () => {
      // Given
      const records = [{ id: 1 }];
      mockNotificationCampaignRepository.findByCohort.mockResolvedValue(records);

      // When
      const result = await service.listByCohort({
        cohortId: 1,
        status: NotificationCampaignStatus.SCHEDULED,
      });

      // Then
      expect(result).toBe(records);
      expect(mockNotificationCampaignRepository.findByCohort).toHaveBeenCalledWith({
        cohortId: 1,
        status: NotificationCampaignStatus.SCHEDULED,
      });
    });
  });
});
