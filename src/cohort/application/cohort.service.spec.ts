import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { AuditLogService } from '../../audit/application/audit-log.service';
import { AppException } from '../../common/exception/app.exception';
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
  update: jest.fn(),
};

const mockAuditLogService = {
  recordStatusChange: jest.fn(),
};

describe('CohortService', () => {
  let cohortService: CohortService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CohortService,
        { provide: CohortRepository, useValue: mockCohortRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
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
      it('기수를 생성하고 반환한다', async () => {
        // Given
        const createdCohort = { id: 1, ...cohortInput };
        mockCohortRepository.checkActiveCohortExists.mockResolvedValue(false);
        mockCohortRepository.register.mockResolvedValue(createdCohort);

        // When
        const result = await cohortService.createCohort({ cohort: cohortInput });

        // Then
        expect(result).toEqual(createdCohort);
        expect(mockCohortRepository.register).toHaveBeenCalledWith({ cohort: cohortInput });
      });
    });
  });

  describe('updateCohort', () => {
    it('상태를 UPCOMING/RECRUITING으로 변경할 때 다른 활성 기수가 있으면 예외를 던진다', async () => {
      mockCohortRepository.findById.mockResolvedValue({ id: 1, status: CohortStatus.ACTIVE });
      mockCohortRepository.checkActiveCohortExistsExcept.mockResolvedValue(true);

      await expect(
        cohortService.updateCohort({
          id: 1,
          data: { status: CohortStatus.RECRUITING },
        }),
      ).rejects.toThrow(new AppException('COHORT_ALREADY_EXISTS', HttpStatus.CONFLICT));
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

    it('오픈된 파트이고 RECRUITING 기수에 속하면 파트를 반환한다', async () => {
      const part = {
        id: 1,
        isOpen: true,
        cohort: { status: CohortStatus.RECRUITING },
      };
      mockCohortRepository.findPartById.mockResolvedValue(part);

      const result = await cohortService.findPartByIdOrThrow({ id: 1 });

      expect(result).toBe(part);
    });
  });
});
