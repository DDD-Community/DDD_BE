jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { AppException } from '../../common/exception/app.exception';
import { EarlyNotificationRepository } from '../domain/early-notification.repository';
import { EarlyNotificationService } from './early-notification.service';
import { NotificationService } from './notification.service';

const mockEarlyNotificationRepository = {
  register: jest.fn(),
  existsByCohortAndEmail: jest.fn(),
  findByCohort: jest.fn(),
  findOne: jest.fn(),
  findManyByIds: jest.fn(),
  markManyNotified: jest.fn(),
};

const mockCohortRepository = {
  findById: jest.fn(),
};

const mockNotificationService = {
  sendEmail: jest.fn(),
};

describe('EarlyNotificationService', () => {
  let earlyNotificationService: EarlyNotificationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EarlyNotificationService,
        { provide: EarlyNotificationRepository, useValue: mockEarlyNotificationRepository },
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: NotificationService, useValue: mockNotificationService },
      ],
    }).compile();

    earlyNotificationService = module.get(EarlyNotificationService);
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    const payload = { cohortId: 1, email: 'test@example.com' };

    it('기수가 존재하지 않으면 COHORT_NOT_FOUND 예외를 던진다', async () => {
      // Given
      mockCohortRepository.findById.mockResolvedValue(null);

      // When & Then
      await expect(earlyNotificationService.subscribe(payload)).rejects.toThrow(
        new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND),
      );
      expect(mockCohortRepository.findById).toHaveBeenCalledWith({ id: 1 });
    });

    it('이미 신청한 이메일이면 기존 레코드를 반환한다', async () => {
      // Given
      const found = { id: 10, cohortId: 1, email: 'test@example.com', notifiedAt: null };
      mockCohortRepository.findById.mockResolvedValue({ id: 1, name: '16기' });
      mockEarlyNotificationRepository.findOne.mockResolvedValue(found);

      // When
      const result = await earlyNotificationService.subscribe(payload);

      // Then
      expect(result).toBe(found);
      expect(mockEarlyNotificationRepository.register).not.toHaveBeenCalled();
    });

    it('신규 이메일이면 등록하고 반환한다', async () => {
      // Given
      const created = { id: 11, cohortId: 1, email: 'test@example.com', notifiedAt: null };
      mockCohortRepository.findById.mockResolvedValue({ id: 1, name: '16기' });
      mockEarlyNotificationRepository.findOne.mockResolvedValue(null);
      mockEarlyNotificationRepository.register.mockResolvedValue(created);

      // When
      const result = await earlyNotificationService.subscribe(payload);

      // Then
      expect(result).toBe(created);
      expect(mockEarlyNotificationRepository.register).toHaveBeenCalledWith({
        cohortId: 1,
        email: 'test@example.com',
      });
    });

    it('동시 요청으로 unique 제약 위반 시 기존 레코드를 반환한다', async () => {
      // Given
      const record = { id: 12, cohortId: 1, email: 'test@example.com', notifiedAt: null };
      mockCohortRepository.findById.mockResolvedValue({ id: 1, name: '16기' });
      mockEarlyNotificationRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(record);

      const uniqueViolation = new QueryFailedError('INSERT', [], new Error('duplicate'));
      (uniqueViolation as unknown as { driverError: { code: string } }).driverError = {
        code: '23505',
      };
      mockEarlyNotificationRepository.register.mockRejectedValue(uniqueViolation);

      // When
      const result = await earlyNotificationService.subscribe(payload);

      // Then
      expect(result).toBe(record);
      expect(mockEarlyNotificationRepository.findOne).toHaveBeenCalledTimes(2);
    });

    it('unique 제약 위반 후 재조회 결과가 null이면 EARLY_NOTIFICATION_CONFLICT(409)를 던진다', async () => {
      // Given
      mockCohortRepository.findById.mockResolvedValue({ id: 1, name: '16기' });
      mockEarlyNotificationRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      const uniqueViolation = new QueryFailedError('INSERT', [], new Error('duplicate'));
      (uniqueViolation as unknown as { driverError: { code: string } }).driverError = {
        code: '23505',
      };
      mockEarlyNotificationRepository.register.mockRejectedValue(uniqueViolation);

      // When & Then
      await expect(earlyNotificationService.subscribe(payload)).rejects.toThrow(
        new AppException('EARLY_NOTIFICATION_CONFLICT', HttpStatus.CONFLICT),
      );
    });
  });

  describe('sendBulk', () => {
    const bulkPayload = {
      cohortId: 1,
      subject: '[DDD] 모집 시작',
      html: '<p>모집</p>',
      text: '모집',
    };

    it('미발송 대상 전원에게 발송 성공하면 전부 notified 처리한다', async () => {
      // Given
      const records = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ];
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue(records);
      mockNotificationService.sendEmail.mockResolvedValue(undefined);
      mockEarlyNotificationRepository.markManyNotified.mockResolvedValue(undefined);

      // When
      const result = await earlyNotificationService.sendBulk(bulkPayload);

      // Then
      expect(result).toEqual({ total: 2, success: 2, failed: 0 });
      expect(mockNotificationService.sendEmail).toHaveBeenCalledTimes(2);
      expect(mockEarlyNotificationRepository.markManyNotified).toHaveBeenCalledWith({
        ids: [1, 2],
        notifiedAt: expect.any(Date) as unknown,
      });
    });

    it('일부 발송 실패 시 성공한 건만 notified 처리한다', async () => {
      // Given
      const records = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
        { id: 3, email: 'c@test.com' },
      ];
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue(records);
      mockNotificationService.sendEmail
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('발송 실패'))
        .mockResolvedValueOnce(undefined);
      mockEarlyNotificationRepository.markManyNotified.mockResolvedValue(undefined);

      // When
      const result = await earlyNotificationService.sendBulk(bulkPayload);

      // Then
      expect(result).toEqual({ total: 3, success: 2, failed: 1 });
      expect(mockEarlyNotificationRepository.markManyNotified).toHaveBeenCalledWith({
        ids: [1, 3],
        notifiedAt: expect.any(Date) as unknown,
      });
    });

    it('전원 발송 실패 시 markManyNotified를 호출하지 않는다', async () => {
      // Given
      const records = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ];
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue(records);
      mockNotificationService.sendEmail.mockRejectedValue(new Error('발송 실패'));

      // When
      const result = await earlyNotificationService.sendBulk(bulkPayload);

      // Then
      expect(result).toEqual({ total: 2, success: 0, failed: 2 });
      expect(mockEarlyNotificationRepository.markManyNotified).not.toHaveBeenCalled();
    });

    it('대상이 없으면 발송 없이 0건 반환한다', async () => {
      // Given
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue([]);

      // When
      const result = await earlyNotificationService.sendBulk(bulkPayload);

      // Then
      expect(result).toEqual({ total: 0, success: 0, failed: 0 });
      expect(mockNotificationService.sendEmail).not.toHaveBeenCalled();
      expect(mockEarlyNotificationRepository.markManyNotified).not.toHaveBeenCalled();
    });
  });

  describe('exportByCohort', () => {
    it('CSV에 UTF-8 BOM이 포함되고 RFC 4180 규칙으로 이스케이프된다', async () => {
      // Given
      const records = [
        {
          id: 1,
          email: 'simple@test.com',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          notifiedAt: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: 2,
          email: 'has,comma@test.com',
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          notifiedAt: null,
        },
        {
          id: 3,
          email: 'has"quote@test.com',
          createdAt: new Date('2026-01-04T00:00:00.000Z'),
          notifiedAt: null,
        },
      ];
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue(records);

      // When
      const result = await earlyNotificationService.exportByCohort({ cohortId: 1 });

      // Then
      expect(result.filename).toMatch(/^early-notifications-cohort-1-\d{8}\.csv$/);
      expect(result.content.startsWith('\uFEFF')).toBe(true);

      const lines = result.content.replace('\uFEFF', '').split('\r\n');
      expect(lines[0]).toBe('id,email,createdAt,notifiedAt');
      expect(lines[1]).toBe('1,simple@test.com,2026-01-01T00:00:00.000Z,2026-01-02T00:00:00.000Z');
      expect(lines[2]).toBe('2,"has,comma@test.com",2026-01-03T00:00:00.000Z,');
      expect(lines[3]).toBe('3,"has""quote@test.com",2026-01-04T00:00:00.000Z,');
    });

    it('이메일에 CR/LF가 포함되면 필드를 따옴표로 감싼다', async () => {
      // Given
      const records = [
        {
          id: 1,
          email: 'line\r\nbreak@test.com',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          notifiedAt: null,
        },
      ];
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue(records);

      // When
      const result = await earlyNotificationService.exportByCohort({ cohortId: 1 });

      // Then
      const body = result.content.replace('\uFEFF', '');
      expect(body).toContain('1,"line\r\nbreak@test.com",2026-01-01T00:00:00.000Z,');
    });
  });
});
