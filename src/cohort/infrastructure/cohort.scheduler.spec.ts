import { Test } from '@nestjs/testing';

import { CohortService } from '../application/cohort.service';
import { CohortScheduler } from './cohort.scheduler';

describe('CohortScheduler', () => {
  let cohortScheduler: CohortScheduler;
  const calls: string[] = [];
  const cohortService = {
    transitionUpcomingToRecruiting: jest.fn(() => {
      calls.push('upcoming->recruiting');
    }),
    transitionExpiredToActive: jest.fn(() => {
      calls.push('recruiting->active');
    }),
    transitionEndedActiveToClosed: jest.fn(() => {
      calls.push('active->closed');
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CohortScheduler, { provide: CohortService, useValue: cohortService }],
    }).compile();

    cohortScheduler = module.get(CohortScheduler);
    calls.length = 0;
    jest.clearAllMocks();
  });

  it('모집 시작 → 활동 시작 → 활동 종료 순서로 전환한다', async () => {
    // 순서가 뒤집히면 같은 날 시작하고 끝나는 기수가 한 틱 안에서 처리되지 않는다.
    await cohortScheduler.transitionExpiredRecruitingCohorts();

    expect(calls).toEqual(['upcoming->recruiting', 'recruiting->active', 'active->closed']);
  });
});
