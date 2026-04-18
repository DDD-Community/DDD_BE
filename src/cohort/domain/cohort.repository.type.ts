import type { CohortStatus } from './cohort.status';

export type CohortUpdatePatch = {
  name?: string;
  recruitStartAt?: Date;
  recruitEndAt?: Date;
  process?: Record<string, unknown>;
  curriculum?: unknown[];
  applicationForm?: Record<string, unknown>;
  status?: CohortStatus;
};
