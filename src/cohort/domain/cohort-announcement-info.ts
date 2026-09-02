/**
 * 결과 안내 메일 본문에 들어가는 기수 정보.
 *
 * 출처는 `cohorts.process` jsonb 다. 스키마가 강제되지 않는 자리라 값이 없거나 형식이
 * 어긋날 수 있고, 그런 항목은 null 로 두어 메일에서 해당 줄을 통째로 생략한다.
 * 안내가 한 줄 빠지는 것이 잘못된 계좌번호나 "undefined" 가 나가는 것보다 낫다.
 */
export type CohortAnnouncementInfo = {
  /** 기수명 (예: 14기) */
  name: string | null;
  /** 면접 슬롯 선택 기한 */
  slotSelectionDeadline: string | null;
  /** 면접 예상 소요 시간(분) */
  interviewDurationMinutes: number | null;
  /** 면접 일정 조정 회신 기한 */
  interviewRescheduleDeadline: string | null;
  /** 참가비(원) */
  participationFee: number | null;
  /** 입금 계좌 (은행명 / 계좌번호 / 예금주) */
  bankAccount: string | null;
  /** 참가비 입금·참여 의사 회신 기한 */
  participationConfirmDeadline: string | null;
};

export const EMPTY_COHORT_ANNOUNCEMENT_INFO: CohortAnnouncementInfo = {
  name: null,
  slotSelectionDeadline: null,
  interviewDurationMinutes: null,
  interviewRescheduleDeadline: null,
  participationFee: null,
  bankAccount: null,
  participationConfirmDeadline: null,
};

const readString = (source: Record<string, unknown>, key: string): string | null => {
  const value = source[key];
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readPositiveNumber = (source: Record<string, unknown>, key: string): number | null => {
  const value = source[key];
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value;
  }
  // jsonb 에 문자열로 들어오는 경우가 흔하다.
  if (typeof value === 'string') {
    const parsed = Number(value.replaceAll(',', '').trim());
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return null;
};

export const toCohortAnnouncementInfo = ({
  name,
  process,
}: {
  name?: string | null;
  process?: Record<string, unknown> | null;
}): CohortAnnouncementInfo => {
  const source = process ?? {};
  return {
    name: typeof name === 'string' && name.trim().length > 0 ? name.trim() : null,
    slotSelectionDeadline: readString(source, 'slotSelectionDeadline'),
    interviewDurationMinutes: readPositiveNumber(source, 'interviewDurationMinutes'),
    interviewRescheduleDeadline: readString(source, 'interviewRescheduleDeadline'),
    participationFee: readPositiveNumber(source, 'participationFee'),
    bankAccount: readString(source, 'bankAccount'),
    participationConfirmDeadline: readString(source, 'participationConfirmDeadline'),
  };
};
