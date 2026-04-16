import type { CohortStatus } from '../domain/cohort.status';

export type CohortFilter = {
  id?: number;
  excludedId?: number;
  status?: CohortStatus;
  statusIn?: CohortStatus[];
  recruitStartAtLte?: Date;
  recruitEndAtLt?: Date;
};

export type CohortExistsQuery = CohortFilter;
