export enum InterviewSlotMeetingStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  READY = 'READY',
  OUT_OF_SYNC = 'OUT_OF_SYNC',
  FAILED = 'FAILED',
}

export const isMeetingBookable = (status: InterviewSlotMeetingStatus): boolean =>
  [
    InterviewSlotMeetingStatus.NONE,
    InterviewSlotMeetingStatus.READY,
    InterviewSlotMeetingStatus.OUT_OF_SYNC,
  ].includes(status);
