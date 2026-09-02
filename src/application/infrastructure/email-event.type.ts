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
  /** cohortPart→cohort 조인 결과. 기수가 soft-delete 되면 null — 예약 링크만 생략된다 */
  cohortId: number | null;
  cohortPartId: number;
  /** cohortPart 조인 결과. 파트가 사라지면 null — 예약 링크만 생략된다 */
  partName: string | null;
  /** cohort.process.interviewEndDate (YYYY-MM-DD). 없으면 null — 토큰 만료 폴백 대상 */
  interviewEndDate: string | null;
};

export type StatusEmailTemplate = {
  subject: string;
  message: string;
  extraHtml?: string;
  extraText?: string;
};

export type RenderedStatusEmailTemplate = {
  subject: string;
  html: string;
  text: string;
};
