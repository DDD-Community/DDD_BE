import { Test } from '@nestjs/testing';

import { ApplicationRepository } from '../domain/application.repository';
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
