import type { ApplicationStatus } from '../domain/application.status';

export type ApplicationFormFilter = {
  id?: number;
  userId?: number;
  cohortPartId?: number;
  cohortPartIds?: number[];
  status?: ApplicationStatus;
};

export type ApplicationFormQuery = {
  where?: ApplicationFormFilter;
  includeUser?: boolean;
  includeCohortPart?: boolean;
};

export type ApplicationDraftFilter = {
  id?: number;
  userId?: number;
  cohortPartId?: number;
};
