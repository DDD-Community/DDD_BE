export type SlotFilter = {
  id?: number;
  cohortId?: number;
  cohortPartId?: number;
};

export type ReservationFilter = {
  id?: number;
  slotId?: number;
  applicationFormId?: number;
};

export type SlotUpdatePatch = {
  startAt?: Date;
  endAt?: Date;
  capacity?: number;
  location?: string;
  description?: string;
};
