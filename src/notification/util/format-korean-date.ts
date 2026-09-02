/**
 * 안내 메일에 쓰는 한국어 날짜 표기.
 *
 * 기수 process 의 기한 값은 운영진이 직접 입력하는 자리라 `2026-09-13` 같은 날짜만 올 수도,
 * 시각까지 붙은 ISO 문자열이 올 수도 있다. 해석되지 않는 값은 원문을 그대로 돌려준다 —
 * 운영진이 "9월 13일 자정" 처럼 문장으로 적어둘 수도 있기 때문이다.
 *
 * 표기는 Intl 의 ko-KR 출력에 기대지 않고 직접 조립한다. 런타임의 ICU 데이터에 따라
 * 같은 코드가 "오후" 대신 "PM" 을 내놓는 일이 있어, 서버마다 메일 문구가 달라지면 안 된다.
 * Intl 은 KST 로 환산한 숫자를 얻는 용도로만 쓴다.
 */

const KST_TIME_ZONE = 'Asia/Seoul';
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;
const EN_WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** 2026-09-18T23:59 / 2026-09-18 23:59:00 — 오프셋이 없는 형태 */
const DATE_TIME_WITHOUT_OFFSET = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;
/** Z 또는 +09:00 처럼 오프셋이 명시된 형태 */
const HAS_EXPLICIT_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

type KstParts = {
  month: number;
  day: number;
  weekday: number | null;
  hour: number;
  minute: string;
};

const toKstParts = (date: Date): KstParts => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: KST_TIME_ZONE,
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  return {
    month: Number(pick('month')),
    day: Number(pick('day')),
    weekday: EN_WEEKDAY_INDEX[pick('weekday')] ?? null,
    hour: Number(pick('hour')),
    minute: pick('minute'),
  };
};

const formatDatePart = ({ month, day, weekday }: KstParts): string => {
  const dayName = weekday === null ? null : WEEKDAYS[weekday];
  // 요일을 못 읽었으면 틀린 요일을 적는 것보다 빼는 편이 낫다.
  return dayName ? `${month}월 ${day}일(${dayName})` : `${month}월 ${day}일`;
};

const formatTimePart = ({ hour, minute }: KstParts): string => {
  const meridiem = hour < 12 ? '오전' : '오후';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${meridiem} ${hour12}:${minute}`;
};

export const formatKoreanDeadline = (value: string): string => {
  const trimmed = value.trim();

  if (DATE_ONLY.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00+09:00`);
    return Number.isNaN(date.getTime()) ? trimmed : formatDatePart(toKstParts(date));
  }

  // 오프셋이 없는 값을 new Date 에 그냥 넘기면 서버 로컬 타임존으로 해석된다.
  // 컨테이너는 UTC 라 운영진이 적은 "2026-09-18 23:59" 가 하루 밀려 안내되므로,
  // 오프셋이 없으면 KST 로 못박는다.
  const normalized = DATE_TIME_WITHOUT_OFFSET.test(trimmed)
    ? `${trimmed.replace(' ', 'T')}+09:00`
    : trimmed;

  // 그 외 형식은 해석을 시도하지 않는다. "9월 18일 자정" 같은 문장을 그대로 살리는 편이,
  // V8 의 관대한 파서가 제멋대로 읽은 날짜를 안내하는 것보다 낫다.
  if (normalized === trimmed && !HAS_EXPLICIT_OFFSET.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return trimmed;
  }
  const parts = toKstParts(parsed);
  return `${formatDatePart(parts)} ${formatTimePart(parts)}`;
};

/** 면접 일시 표기: 9월 19일(토) 오후 2:00 */
export const formatKoreanDateTime = (date: Date): string => {
  const parts = toKstParts(date);
  return `${formatDatePart(parts)} ${formatTimePart(parts)}`;
};

export const diffMinutes = ({ startAt, endAt }: { startAt: Date; endAt: Date }): number =>
  Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60_000));
