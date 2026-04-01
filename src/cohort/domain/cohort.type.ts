import type { CohortStatus } from './cohort.status';

export type CohortPartCreateType = {
  partName: string;
  isOpen?: boolean;
  applicationSchema: Record<string, unknown>;
};

export type CohortCreateType = {
  name: string;
  recruitStartAt: Date;
  recruitEndAt: Date;
  status?: CohortStatus;
  parts?: CohortPartCreateType[];
};

export type CohortUpdateType = {
  name?: string;
  recruitStartAt?: Date;
  recruitEndAt?: Date;
  status?: CohortStatus;
};
