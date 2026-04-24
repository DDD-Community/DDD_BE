import { Test } from '@nestjs/testing';

import { CohortRepository } from '../../cohort/domain/cohort.repository';
import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import { ApplicationQueryService } from './application-query.service';

const mockApplicationRepository = {
  findFormsByFilter: jest.fn(),
};

const mockCohortRepository = {
  findById: jest.fn(),
};

describe('ApplicationQueryService', () => {
  let queryService: ApplicationQueryService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ApplicationQueryService,
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
        { provide: CohortRepository, useValue: mockCohortRepository },
      ],
    }).compile();

    queryService = module.get(ApplicationQueryService);
    jest.clearAllMocks();
  });

  describe('findFormsWithFilter', () => {
    it('cohortPartId가 주어지면 해당 partId로 바로 조회한다', async () => {
      mockApplicationRepository.findFormsByFilter.mockResolvedValue([]);

      await queryService.findFormsWithFilter({ cohortPartId: 5 });

      expect(mockApplicationRepository.findFormsByFilter).toHaveBeenCalledWith({
        cohortPartIds: [5],
        status: undefined,
      });
      expect(mockCohortRepository.findById).not.toHaveBeenCalled();
    });

    it('cohortId가 주어지면 해당 cohort의 partIds를 해소하여 조회한다', async () => {
      mockCohortRepository.findById.mockResolvedValue({
        id: 1,
        parts: [{ id: 10 }, { id: 11 }, { id: 12 }],
      });
      mockApplicationRepository.findFormsByFilter.mockResolvedValue([]);

      await queryService.findFormsWithFilter({
        cohortId: 1,
        status: ApplicationStatus.서류심사대기,
      });

      expect(mockCohortRepository.findById).toHaveBeenCalledWith({ id: 1 });
      expect(mockApplicationRepository.findFormsByFilter).toHaveBeenCalledWith({
        cohortPartIds: [10, 11, 12],
        status: ApplicationStatus.서류심사대기,
      });
    });

    it('cohortId에 해당하는 cohort가 없으면 빈 배열로 조회한다', async () => {
      mockCohortRepository.findById.mockResolvedValue(null);
      mockApplicationRepository.findFormsByFilter.mockResolvedValue([]);

      await queryService.findFormsWithFilter({ cohortId: 999 });

      expect(mockApplicationRepository.findFormsByFilter).toHaveBeenCalledWith({
        cohortPartIds: [],
        status: undefined,
      });
    });

    it('필터가 없으면 전체 조회한다', async () => {
      mockApplicationRepository.findFormsByFilter.mockResolvedValue([]);

      await queryService.findFormsWithFilter({});

      expect(mockApplicationRepository.findFormsByFilter).toHaveBeenCalledWith({
        cohortPartIds: undefined,
        status: undefined,
      });
    });
  });
});
