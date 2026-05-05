jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { QueryFailedError } from 'typeorm';

import { AppException } from '../../common/exception/app.exception';
import { EarlyNotificationRepository } from '../domain/early-notification.repository';
import { GeneralEarlyNotificationRepository } from '../domain/general-early-notification.repository';
import { GeneralEarlyNotificationService } from './general-early-notification.service';

const mockGeneralEarlyNotificationRepository = {
  register: jest.fn(),
  findUnpromotedByEmail: jest.fn(),
  findUnpromoted: jest.fn(),
  markManyPromoted: jest.fn(),
};

const mockEarlyNotificationRepository = {
  register: jest.fn(),
  existsByCohortAndEmail: jest.fn(),
  findByCohort: jest.fn(),
  findOne: jest.fn(),
  findManyByIds: jest.fn(),
  markManyNotified: jest.fn(),
};

const makeUniqueViolation = () => {
  const error = new QueryFailedError('INSERT', [], new Error('duplicate'));
  (error as unknown as { driverError: { code: string } }).driverError = { code: '23505' };
  return error;
};

describe('GeneralEarlyNotificationService', () => {
  let service: GeneralEarlyNotificationService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        GeneralEarlyNotificationService,
        {
          provide: GeneralEarlyNotificationRepository,
          useValue: mockGeneralEarlyNotificationRepository,
        },
        { provide: EarlyNotificationRepository, useValue: mockEarlyNotificationRepository },
      ],
    }).compile();

    service = moduleRef.get(GeneralEarlyNotificationService);
    jest.clearAllMocks();
  });

  describe('subscribe', () => {
    const payload = { email: 'test@example.com' };

    it('이미 미승격 상태로 등록된 이메일이면 기존 레코드를 반환한다', async () => {
      // Given
      const found = { id: 1, email: 'test@example.com', promotedAt: null };
      mockGeneralEarlyNotificationRepository.findUnpromotedByEmail.mockResolvedValue(found);

      // When
      const result = await service.subscribe(payload);

      // Then
      expect(result).toBe(found);
      expect(mockGeneralEarlyNotificationRepository.register).not.toHaveBeenCalled();
    });

    it('신규 이메일이면 등록하고 반환한다', async () => {
      // Given
      const created = { id: 2, email: 'test@example.com', promotedAt: null };
      mockGeneralEarlyNotificationRepository.findUnpromotedByEmail.mockResolvedValue(null);
      mockGeneralEarlyNotificationRepository.register.mockResolvedValue(created);

      // When
      const result = await service.subscribe(payload);

      // Then
      expect(result).toBe(created);
      expect(mockGeneralEarlyNotificationRepository.register).toHaveBeenCalledWith({
        email: 'test@example.com',
      });
    });

    it('동시 요청으로 unique 제약 위반 시 기존 레코드를 반환한다', async () => {
      // Given
      const record = { id: 3, email: 'test@example.com', promotedAt: null };
      mockGeneralEarlyNotificationRepository.findUnpromotedByEmail
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(record);
      mockGeneralEarlyNotificationRepository.register.mockRejectedValue(makeUniqueViolation());

      // When
      const result = await service.subscribe(payload);

      // Then
      expect(result).toBe(record);
      expect(mockGeneralEarlyNotificationRepository.findUnpromotedByEmail).toHaveBeenCalledTimes(2);
    });

    it('unique 위반 후 재조회가 null이면 GENERAL_EARLY_NOTIFICATION_CONFLICT(409)를 던진다', async () => {
      // Given
      mockGeneralEarlyNotificationRepository.findUnpromotedByEmail.mockResolvedValue(null);
      mockGeneralEarlyNotificationRepository.register.mockRejectedValue(makeUniqueViolation());

      // When & Then
      await expect(service.subscribe(payload)).rejects.toThrow(
        new AppException('GENERAL_EARLY_NOTIFICATION_CONFLICT', HttpStatus.CONFLICT),
      );
    });
  });

  describe('promoteToCohort', () => {
    it('대기열이 비어있으면 0건을 반환하고 추가 호출이 없다', async () => {
      // Given
      mockGeneralEarlyNotificationRepository.findUnpromoted.mockResolvedValue([]);

      // When
      const result = await service.promoteToCohort({ cohortId: 10 });

      // Then
      expect(result).toEqual({ total: 0, promoted: 0, skippedDuplicate: 0 });
      expect(mockEarlyNotificationRepository.findByCohort).not.toHaveBeenCalled();
      expect(mockEarlyNotificationRepository.register).not.toHaveBeenCalled();
      expect(mockGeneralEarlyNotificationRepository.markManyPromoted).not.toHaveBeenCalled();
    });

    it('모두 신규면 전부 등록하고 일괄 promoted 처리한다', async () => {
      // Given
      const waitlist = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ];
      mockGeneralEarlyNotificationRepository.findUnpromoted.mockResolvedValue(waitlist);
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue([]);
      mockEarlyNotificationRepository.register.mockResolvedValue(undefined);

      // When
      const result = await service.promoteToCohort({ cohortId: 10 });

      // Then
      expect(result).toEqual({ total: 2, promoted: 2, skippedDuplicate: 0 });
      expect(mockEarlyNotificationRepository.findByCohort).toHaveBeenCalledWith({ cohortId: 10 });
      expect(mockEarlyNotificationRepository.register).toHaveBeenCalledTimes(2);
      expect(mockEarlyNotificationRepository.register).toHaveBeenNthCalledWith(1, {
        cohortId: 10,
        email: 'a@test.com',
      });
      expect(mockEarlyNotificationRepository.register).toHaveBeenNthCalledWith(2, {
        cohortId: 10,
        email: 'b@test.com',
      });
      expect(mockGeneralEarlyNotificationRepository.markManyPromoted).toHaveBeenCalledWith({
        ids: [1, 2],
        promotedAt: expect.any(Date) as unknown,
        cohortId: 10,
      });
    });

    it('이미 그 기수에 등록된 이메일은 skippedDuplicate로 처리하고 register는 호출하지 않는다', async () => {
      // Given
      const waitlist = [
        { id: 1, email: 'a@test.com' },
        { id: 2, email: 'b@test.com' },
      ];
      mockGeneralEarlyNotificationRepository.findUnpromoted.mockResolvedValue(waitlist);
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue([
        { id: 99, cohortId: 10, email: 'a@test.com' },
      ]);
      mockEarlyNotificationRepository.register.mockResolvedValue(undefined);

      // When
      const result = await service.promoteToCohort({ cohortId: 10 });

      // Then
      expect(result).toEqual({ total: 2, promoted: 1, skippedDuplicate: 1 });
      expect(mockEarlyNotificationRepository.register).toHaveBeenCalledTimes(1);
      expect(mockEarlyNotificationRepository.register).toHaveBeenCalledWith({
        cohortId: 10,
        email: 'b@test.com',
      });
      expect(mockGeneralEarlyNotificationRepository.markManyPromoted).toHaveBeenCalledWith({
        ids: [1, 2],
        promotedAt: expect.any(Date) as unknown,
        cohortId: 10,
      });
    });

    it('register 중 에러가 발생하면 그대로 throw하고 markManyPromoted를 호출하지 않는다', async () => {
      // Given
      const waitlist = [{ id: 1, email: 'a@test.com' }];
      mockGeneralEarlyNotificationRepository.findUnpromoted.mockResolvedValue(waitlist);
      mockEarlyNotificationRepository.findByCohort.mockResolvedValue([]);
      mockEarlyNotificationRepository.register.mockRejectedValue(new Error('DB down'));

      // When & Then
      await expect(service.promoteToCohort({ cohortId: 10 })).rejects.toThrow('DB down');
      expect(mockGeneralEarlyNotificationRepository.markManyPromoted).not.toHaveBeenCalled();
    });
  });
});
