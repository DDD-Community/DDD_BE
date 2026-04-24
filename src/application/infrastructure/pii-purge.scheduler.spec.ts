import { Test } from '@nestjs/testing';

import { ApplicationRepository } from '../domain/application.repository';
import { ApplicationStatus } from '../domain/application.status';
import type { DraftWriteRepository } from './draft.write.repository';
import type { FormWriteRepository } from './form.write.repository';
import { PiiPurgeScheduler } from './pii-purge.scheduler';

const mockApplicationRepository = {
  purgeExpiredPii: jest.fn(),
};

describe('PiiPurgeScheduler', () => {
  let scheduler: PiiPurgeScheduler;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PiiPurgeScheduler,
        { provide: ApplicationRepository, useValue: mockApplicationRepository },
      ],
    }).compile();

    scheduler = module.get(PiiPurgeScheduler);
    jest.clearAllMocks();
  });

  describe('purgeExpiredPii', () => {
    it('180일 이전 기준일로 파기를 요청한다', async () => {
      // Given
      mockApplicationRepository.purgeExpiredPii.mockResolvedValue(3);

      // When
      await scheduler.purgeExpiredPii();

      // Then
      expect(mockApplicationRepository.purgeExpiredPii).toHaveBeenCalledTimes(1);

      const calledCutoff = (
        mockApplicationRepository.purgeExpiredPii.mock.calls[0] as [{ cutoffDate: Date }]
      )[0].cutoffDate;
      const expectedCutoff = new Date();
      expectedCutoff.setDate(expectedCutoff.getDate() - 180);

      const diffMs = Math.abs(calledCutoff.getTime() - expectedCutoff.getTime());
      expect(diffMs).toBeLessThan(1000);
    });
  });
});

describe('ApplicationRepository.purgeExpiredPii (기산점 우선순위)', () => {
  it('terminalStatuses에 활동완료/활동중단이 포함된 상태로 nullifyPii를 호출한다', async () => {
    const nullifyPii = jest.fn().mockResolvedValue(0);
    const formWriteRepository = { nullifyPii } as unknown as FormWriteRepository;
    const draftWriteRepository = {} as unknown as DraftWriteRepository;

    const repository = new ApplicationRepository(formWriteRepository, draftWriteRepository);

    const cutoffDate = new Date();
    await repository.purgeExpiredPii({ cutoffDate });

    expect(nullifyPii).toHaveBeenCalledWith({
      terminalStatuses: expect.arrayContaining([
        ApplicationStatus.서류불합격,
        ApplicationStatus.최종합격,
        ApplicationStatus.최종불합격,
        ApplicationStatus.활동완료,
        ApplicationStatus.활동중단,
      ]) as ApplicationStatus[],
      cutoffDate,
    });
  });
});
