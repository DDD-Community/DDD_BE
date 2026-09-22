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

/** 일정 입력에서 날짜 부분만 뽑아내기 위한 패턴. 뒤따르는 시각·오프셋은 보지 않는다. */
const SCHEDULE_DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * 일정 입력 문자열을 "표기된 날짜"의 UTC 자정으로 정규화한다.
 *
 * Date 로 바꾸는 순간 오프셋 표기가 사라지므로, 어느 날짜를 뜻했는지는 문자열일 때만 알 수 있다.
 * `2026-09-21T00:00:00+09:00`(한국 자정)을 그대로 Date 로 만들면 UTC 로는 9/20 15:00 이 되어
 * 달력 날짜가 하루 앞당겨진다. 반대로 `2026-09-21T23:59:59Z` 는 한국시간으로 9/22 라
 * 한국 기준으로 환산하면 하루 밀린다. 어느 쪽도 운영진이 적은 날짜가 아니다.
 *
 * 그래서 시각과 오프셋은 버리고 **적힌 날짜 그대로**를 쓴다. 위 두 입력은 모두 9월 21일이 된다.
 *
 * Date.UTC 는 범위를 벗어난 구성 요소를 조용히 롤오버시키므로(13월 1일 -> 이듬해 1월)
 * 되짚어 확인하고 어긋나면 원본 파싱에 맡긴다. 이는 기존 new Date(문자열) 동작을 그대로
 * 유지하기 위한 것이다 - 2월 30일처럼 V8 이 롤오버하는 입력은 여기서도 롤오버된다.
 */
export const parseScheduleDate = ({ value }: { value: unknown }): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const matched = SCHEDULE_DATE_PREFIX.exec(value.trim());
  if (!matched) {
    return new Date(value);
  }

  const [, year, month, day] = matched.map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isValidCalendarDate =
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day;
  return isValidCalendarDate ? parsed : new Date(value);
};
