import type { ApplicationStatus } from '../domain/application.status';

export type ApplicationSubmittedEventPayload = {
  email: string;
  name: string;
};

export type ApplicationStatusChangedEventPayload = {
  email: string;
  name: string;
  newStatus: ApplicationStatus;
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
