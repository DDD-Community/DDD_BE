import { Test } from '@nestjs/testing';

import { AuditAction } from '../domain/audit-action';
import { AuditLogRepository } from '../domain/audit-log.repository';
import { AuditLogService } from './audit-log.service';

const mockAuditLogRepository = {
  record: jest.fn(),
  findRecentByEntity: jest.fn(),
};

describe('AuditLogService', () => {
  let service: AuditLogService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: AuditLogRepository, useValue: mockAuditLogRepository },
      ],
    }).compile();

    service = module.get(AuditLogService);
    jest.clearAllMocks();
  });

  describe('recordStatusChange', () => {
    it('상태 변경 이력을 STATUS_CHANGE action + field=status로 기록한다', async () => {
      // Given
      mockAuditLogRepository.record.mockResolvedValue({});

      // When
      await service.recordStatusChange({
        entityType: 'cohort',
        entityId: 1,
        fromValue: 'UPCOMING',
        toValue: 'RECRUITING',
        adminId: 42,
      });

      // Then
      expect(mockAuditLogRepository.record).toHaveBeenCalledWith({
        entityType: 'cohort',
        entityId: 1,
        action: AuditAction.STATUS_CHANGE,
        field: 'status',
        fromValue: 'UPCOMING',
        toValue: 'RECRUITING',
        adminId: 42,
      });
    });
  });
});
