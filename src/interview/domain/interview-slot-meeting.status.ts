export enum InterviewSlotMeetingStatus {
  NONE = 'NONE',
  PENDING = 'PENDING',
  READY = 'READY',
  OUT_OF_SYNC = 'OUT_OF_SYNC',
  FAILED = 'FAILED',
}

/**
 * 예약을 받을 수 있는 상태. OUT_OF_SYNC 는 넣지 않는다 — 주인 교체가 실패하면 이전 주인의 회의가,
 * 시간 변경 반영이 실패하면 틀린 시각의 일정이 남아 있다. 스케줄러가 1분마다 다시 맞추므로
 * 예약이 막히는 시간은 짧다.
 */
export const isMeetingBookable = (status: InterviewSlotMeetingStatus): boolean =>
  [InterviewSlotMeetingStatus.NONE, InterviewSlotMeetingStatus.READY].includes(status);
