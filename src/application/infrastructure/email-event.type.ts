import type { ApplicationStatus } from '../domain/application.status';

export type ApplicationSubmittedEventPayload = {
  email: string;
  name: string;
};

export type ApplicationStatusChangedEventPayload = {
  email: string;
  name: string;
  newStatus: ApplicationStatus;
  applicationFormId: number;
  cohortId: number;
  cohortPartId: number;
  partName: string;
  /** cohort.process.interviewEndDate (YYYY-MM-DD). 없으면 null — 토큰 만료 폴백 대상 */
  interviewEndDate: string | null;
};

export type StatusEmailTemplate = {
  subject: string;
  message: string;
};

export type RenderedStatusEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};
