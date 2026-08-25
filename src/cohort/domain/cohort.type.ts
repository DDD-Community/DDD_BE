import type { CohortStatus } from './cohort.status';
import type { CohortPartName } from './cohort-part-name';

export type CohortPartCreateType = {
  partName: CohortPartName;
  isOpen?: boolean;
  applicationSchema: Record<string, unknown>;
};

export type CohortCreateType = {
  name: string;
  recruitStartAt: Date;
  recruitEndAt: Date;
  activityEndAt?: Date;
  process?: Record<string, unknown>;
  curriculum?: unknown[];
  applicationForm?: Record<string, unknown>;
  status?: CohortStatus;
  parts?: CohortPartCreateType[];
};

export type CohortUpdateType = {
  name?: string;
  recruitStartAt?: Date;
  recruitEndAt?: Date;
  /** null 을 보내면 자동 종료 예약을 해제한다. */
  activityEndAt?: Date | null;
  process?: Record<string, unknown>;
  curriculum?: unknown[];
  applicationForm?: Record<string, unknown>;
  status?: CohortStatus;
};
