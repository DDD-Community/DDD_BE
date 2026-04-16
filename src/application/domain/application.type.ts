import type { ApplicationStatus } from './application.status';

export type ApplicationAdminFilter = {
  cohortId?: number;
  cohortPartId?: number;
  status?: ApplicationStatus;
};

export type SaveDraftCommand = {
  cohortPartId: number;
  answers: Record<string, unknown>;
};

export type SubmitFormCommand = {
  cohortPartId: number;
  applicantName: string;
  applicantPhone: string;
  applicantBirthDate?: string;
  applicantRegion?: string;
  answers: Record<string, unknown>;
  privacyAgreed: boolean;
};

export type UpdateStatusCommand = {
  status: ApplicationStatus;
};
