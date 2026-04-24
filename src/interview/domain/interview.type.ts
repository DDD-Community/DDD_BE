export type InterviewSlotCreateInput = {
  cohortId: number;
  cohortPartId: number;
  startAt: Date;
  endAt: Date;
  capacity: number;
  location?: string;
  description?: string;
};

export type InterviewSlotUpdatePatch = {
  startAt?: Date;
  endAt?: Date;
  capacity?: number;
  location?: string;
  description?: string;
};

export type ReservationCreateInput = {
  slotId: number;
  applicationFormId: number;
  applicantName: string;
  applicantEmail: string;
};
