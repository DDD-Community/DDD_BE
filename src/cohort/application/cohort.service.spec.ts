import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
import { GeneralEarlyNotificationService } from '../../notification/application/general-early-notification.service';
import { NotificationCampaignService } from '../../notification/application/notification-campaign.service';
import { CohortRepository } from '../domain/cohort.repository';
import { CohortStatus } from '../domain/cohort.status';
import { CohortService } from './cohort.service';

jest.mock('typeorm-transactional', () => ({
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
    descriptor,
  initializeTransactionalContext: jest.fn(),
}));

const mockCohortRepository = {
  register: jest.fn(),
  checkActiveCohortExists: jest.fn(),
  findById: jest.fn(),
  findPartById: jest.fn(),
  checkActiveCohortExistsExcept: jest.fn(),
  findActive: jest.fn(),
  update: jest.fn(),
};

const mockAuditLogService = {
  recordStatusChange: jest.fn(),
};

const mockGeneralEarlyNotificationService = {
  promoteToCohort: jest.fn(),
  subscribe: jest.fn(),
};

const mockNotificationCampaignService = {
  registerDefaultForCohort: jest.fn(),
};

const daysFromNow = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

const createRecruitingWindow = ({
  startDayOffset = -1,
  endDayOffset = 1,
}: { startDayOffset?: number; endDayOffset?: number } = {}) => ({
  status: CohortStatus.RECRUITING,
  recruitStartAt: daysFromNow(startDayOffset),
  recruitEndAt: daysFromNow(endDayOffset),
});

describe('CohortService', () => {
  let cohortService: CohortService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CohortService,
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        {
          provide: GeneralEarlyNotificationService,
          useValue: mockGeneralEarlyNotificationService,
        },
        {
          provide: NotificationCampaignService,
          useValue: mockNotificationCampaignService,
        },
      ],
    }).compile();

    cohortService = module.get(CohortService);
    jest.clearAllMocks();
  });

  describe('createCohort', () => {
    const cohortInput = {
      name: '1기',
      recruitStartAt: new Date('2024-01-01'),
      recruitEndAt: new Date('2024-01-31'),
      status: CohortStatus.UPCOMING,
    };

    describe('UPCOMING 또는 RECRUITING 기수가 이미 존재할 때', () => {
      it('COHORT_ALREADY_EXISTS 예외를 던진다', async () => {
        // Given
        mockCohortRepository.checkActiveCohortExists.mockResolvedValue(true);

        // When & Then
        await expect(cohortService.createCohort({ cohort: cohortInput })).rejects.toThrow(
          new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT),
        );
        expect(mockCohortRepository.register).not.toHaveBeenCalled();
      });
    });

    describe('활성 기수가 없을 때', () => {
      it('기수를 생성하고 대기열 승격 + 기본 캠페인 등록 후 반환한다', async () => {
        // Given
        const createdCohort = { id: 1, ...cohortInput };
        mockCohortRepository.checkActiveCohortExists.mockResolvedValue(false);
        mockCohortRepository.register.mockResolvedValue(createdCohort);
        mockGeneralEarlyNotificationService.promoteToCohort.mockResolvedValue({
          total: 0,
          promoted: 0,
          skippedDuplicate: 0,
        });
        mockNotificationCampaignService.registerDefaultForCohort.mockResolvedValue({
          id: 100,
        });

        // When
        const result = await cohortService.createCohort({ cohort: cohortInput });

        // Then
        expect(result).toEqual(createdCohort);
        expect(mockCohortRepository.register).toHaveBeenCalledWith({ cohort: cohortInput });
        expect(mockGeneralEarlyNotificationService.promoteToCohort).toHaveBeenCalledWith({
          cohortId: 1,
        });
        expect(mockNotificationCampaignService.registerDefaultForCohort).toHaveBeenCalledWith({
          cohort: createdCohort,
        });
      });

      it('대기열 승격이 실패하면 createCohort 자체가 실패한다 (트랜잭션 롤백)', async () => {
        // Given
        const createdCohort = { id: 2, ...cohortInput };
        mockCohortRepository.checkActiveCohortExists.mockResolvedValue(false);
        mockCohortRepository.register.mockResolvedValue(createdCohort);
        mockGeneralEarlyNotificationService.promoteToCohort.mockRejectedValue(
          new Error('promote failed'),
        );

        // When & Then
        await expect(cohortService.createCohort({ cohort: cohortInput })).rejects.toThrow(
          'promote failed',
        );
        expect(mockNotificationCampaignService.registerDefaultForCohort).not.toHaveBeenCalled();
      });

      it('기본 캠페인 등록이 실패하면 createCohort 자체가 실패한다 (트랜잭션 롤백)', async () => {
        // Given
        const createdCohort = { id: 3, ...cohortInput };
        mockCohortRepository.checkActiveCohortExists.mockResolvedValue(false);
        mockCohortRepository.register.mockResolvedValue(createdCohort);
        mockGeneralEarlyNotificationService.promoteToCohort.mockResolvedValue({
          total: 0,
          promoted: 0,
          skippedDuplicate: 0,
        });
        mockNotificationCampaignService.registerDefaultForCohort.mockRejectedValue(
          new Error('campaign registration failed'),
        );

        // When & Then
        await expect(cohortService.createCohort({ cohort: cohortInput })).rejects.toThrow(
          'campaign registration failed',
        );
      });
    });
  });

  describe('updateCohort', () => {
    it('상태를 UPCOMING/RECRUITING으로 변경할 때 다른 활성 기수가 있으면 예외를 던진다', async () => {
      mockCohortRepository.findById.mockResolvedValue({
        id: 1,
        status: CohortStatus.ACTIVE,
        recruitStartAt: new Date('2026-08-29T00:00:00.000Z'),
        recruitEndAt: new Date('2026-09-05T00:00:00.000Z'),
      });
      mockCohortRepository.checkActiveCohortExistsExcept.mockResolvedValue(true);

      await expect(
        cohortService.updateCohort({
          id: 1,
          data: { status: CohortStatus.RECRUITING },
        }),
      ).rejects.toThrow(new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT));
    });
  });

  describe('모집 기간 정합성 검증', () => {
    const invalidPeriod = new AppException('INVALID_RECRUIT_PERIOD', HttpStatus.BAD_REQUEST);

    it('생성 시 모집 시작일이 종료일보다 늦으면 예외를 던진다', async () => {
      mockCohortRepository.checkActiveCohortExists.mockResolvedValue(false);

      await expect(
        cohortService.createCohort({
          cohort: {
            name: '15기',
            recruitStartAt: new Date('2026-09-10T00:00:00.000Z'),
            recruitEndAt: new Date('2026-09-01T00:00:00.000Z'),
          },
        }),
      ).rejects.toThrow(invalidPeriod);
      expect(mockCohortRepository.register).not.toHaveBeenCalled();
    });

    it('수정 시 기존 값과 병합한 결과가 역전되면 예외를 던진다', async () => {
      mockCohortRepository.findById.mockResolvedValue({
        id: 1,
        status: CohortStatus.RECRUITING,
        recruitStartAt: new Date('2026-08-29T00:00:00.000Z'),
        recruitEndAt: new Date('2026-09-05T00:00:00.000Z'),
      });

      await expect(
        cohortService.updateCohort({
          id: 1,
          data: { recruitEndAt: new Date('2026-08-01T00:00:00.000Z') },
        }),
      ).rejects.toThrow(invalidPeriod);
      expect(mockCohortRepository.update).not.toHaveBeenCalled();
    });

    it('수정 결과가 정상 구간이면 저장한다', async () => {
      mockCohortRepository.findById.mockResolvedValue({
        id: 1,
        status: CohortStatus.RECRUITING,
        recruitStartAt: new Date('2026-08-29T00:00:00.000Z'),
        recruitEndAt: new Date('2026-09-05T00:00:00.000Z'),
      });

      await cohortService.updateCohort({
        id: 1,
        data: { recruitEndAt: new Date('2026-09-12T00:00:00.000Z') },
      });

      expect(mockCohortRepository.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('findPartByIdOrThrow', () => {
    const expectedException = new AppException('COHORT_PART_NOT_FOUND', HttpStatus.NOT_FOUND);

    it('파트가 존재하지 않으면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue(null);

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });

    it('파트가 닫혀있으면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: false,
        cohort: { status: CohortStatus.RECRUITING },
      });

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });

    it('소속 기수가 RECRUITING이 아니면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: { status: CohortStatus.UPCOMING },
      });

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });

    it('파트의 cohort relation이 비어있으면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: undefined,
      });

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });

    it('오픈된 파트이고 모집 기간 안이면 파트를 반환한다', async () => {
      const part = {
        id: 1,
        isOpen: true,
        cohort: createRecruitingWindow(),
      };
      mockCohortRepository.findPartById.mockResolvedValue(part);

      const result = await cohortService.findPartByIdOrThrow({ id: 1 });

      expect(result).toBe(part);
    });

    it('RECRUITING 이어도 모집 시작 전이면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createRecruitingWindow({ startDayOffset: 13, endDayOffset: 20 }),
      });

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });

    it('RECRUITING 이어도 모집 종료 후면 404를 던진다', async () => {
      mockCohortRepository.findPartById.mockResolvedValue({
        id: 1,
        isOpen: true,
        cohort: createRecruitingWindow({ startDayOffset: -20, endDayOffset: -1 }),
      });

      await expect(cohortService.findPartByIdOrThrow({ id: 1 })).rejects.toThrow(expectedException);
    });
  });

  describe('findActiveCohort', () => {
    const makeCohort = ({
      id,
      status,
      startDayOffset,
    }: {
      id: number;
      status: CohortStatus;
      startDayOffset: number;
    }) => ({
      id,
      status,
      recruitStartAt: daysFromNow(startDayOffset),
      recruitEndAt: daysFromNow(startDayOffset + 10),
    });

    it('모집이 끝난 기수만 남아도 가장 최근 기수를 반환한다', async () => {
      // Given — 전 기수가 활동 종료된 상태
      mockCohortRepository.findActive.mockResolvedValue([
        makeCohort({ id: 8, status: CohortStatus.CLOSED, startDayOffset: -400 }),
        makeCohort({ id: 13, status: CohortStatus.CLOSED, startDayOffset: -30 }),
      ]);

      // When
      const result = await cohortService.findActiveCohort();

      // Then — null 을 반환하면 CTA 가 사전 알림으로 잘못 떨어진다
      expect(result?.id).toBe(13);
    });

    it('활동 중 기수가 있으면 종료된 기수보다 우선한다', async () => {
      // Given
      mockCohortRepository.findActive.mockResolvedValue([
        makeCohort({ id: 13, status: CohortStatus.CLOSED, startDayOffset: -30 }),
        makeCohort({ id: 10, status: CohortStatus.ACTIVE, startDayOffset: -5 }),
      ]);

      // When
      const result = await cohortService.findActiveCohort();

      // Then
      expect(result?.id).toBe(10);
    });

    it('기수가 하나도 없으면 null 을 반환한다', async () => {
      // Given
      mockCohortRepository.findActive.mockResolvedValue([]);

      // When
      const result = await cohortService.findActiveCohort();

      // Then
      expect(result).toBeNull();
    });
  });
});
