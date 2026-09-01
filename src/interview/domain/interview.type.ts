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

export type ApplicantReservationCreateInput = {
  slotId: number;
  applicationFormId: number;
  /** 예약 토큰에서 온 직군 — 슬롯 소유 검증용 */
  cohortPartId: number;
};
