/**
 * 기수 일정의 "한국 날짜 감각"과 저장 형식을 잇는 유틸.
 *
 * 일정은 어드민에서 한국 날짜로 입력되지만 값은 UTC 로 저장되고,
 * 같은 날짜가 00:00:00Z 로도 23:59:59Z 로도 들어온다(어느 쪽이든 달력 날짜는 같다).
 * 그래서 저장값에서는 시각이 아니라 **UTC 달력 날짜**만 의미를 갖고,
 * 그 날짜가 곧 운영진이 의도한 한국 날짜다.
 *
 * 저장된 시각을 그대로 비교하면 한국시간 오전 9시가 하루의 경계가 되어
 * "9월 21일부터"가 실제로는 9월 21일 오전 9시부터가 된다.
 * 아래 함수들은 저장값의 달력 날짜를 실제 한국시간 경계로 환산해,
 * 모집 개폐 판정과 상태 전환 스케줄러가 같은 하루를 보도록 맞춘다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type KstStoredDateRange = {
  start: Date;
  end: Date;
};

/** 저장된 일정값이 가리키는 한국 날짜의 00:00:00.000 */
export const toKstDayStart = ({ date }: { date: Date }): Date => {
  const utcMidnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return new Date(utcMidnight - KST_OFFSET_MS);
};

/** 저장된 일정값이 가리키는 한국 날짜의 23:59:59.999 */
export const toKstDayEnd = ({ date }: { date: Date }): Date => {
  const start = toKstDayStart({ date });
  return new Date(start.getTime() + DAY_MS - 1);
};

/**
 * 오늘(한국 날짜)을 일정 저장값과 같은 표기로 옮긴 범위.
 *
 * DB 조회에서 쓴다. 컬럼에 변환 함수를 씌우면 인덱스를 못 타므로 비교 기준값 쪽을 옮긴다.
 * 저장값이 같은 날짜를 00:00:00Z 로도 23:59:59Z 로도 표현하므로 한쪽 끝이 아니라 범위로 준다.
 * - `recruitEndAt < start`  -> 그 한국 날짜가 통째로 지났다
 * - `recruitStartAt <= end` -> 그 한국 날짜가 이미 시작됐다
 */
export const kstTodayStoredRange = ({ now }: { now: Date }): KstStoredDateRange => {
  const kstShifted = new Date(now.getTime() + KST_OFFSET_MS);
  const start = new Date(
    Date.UTC(kstShifted.getUTCFullYear(), kstShifted.getUTCMonth(), kstShifted.getUTCDate()),
  );
  const end = new Date(start.getTime() + DAY_MS - 1);
  return { start, end };
};
