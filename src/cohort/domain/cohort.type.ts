import type { CohortStatus } from './cohort.status';

export type CohortCreateType = {
  name: string;
  recruitStartAt: Date;
  recruitEndAt: Date;
  status?: CohortStatus;
};
