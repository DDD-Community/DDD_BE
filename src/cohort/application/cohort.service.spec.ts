import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';

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
};

describe('CohortService', () => {
  let cohortService: CohortService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CohortService, { provide: CohortRepository, useValue: mockCohortRepository }],
    }).compile();

    cohortService = module.get(CohortService);
    jest.clearAllMocks();
  });

  describe('createCohort', () => {
    const cohortInput = {
      name: '1기',
      recruitStartAt: new Date('2024-01-01'),
      recruitEndAt: new Date('2024-01-31'),
      status: CohortStatus.PLANNED,
    };

    describe('PLANNED 또는 RECRUITING 기수가 이미 존재할 때', () => {
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
});
