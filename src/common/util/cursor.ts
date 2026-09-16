export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

export type CursorClaim = {
  createdAt: number;
  id: number;
  /**
   * 기수 순으로 정렬하는 목록(프로젝트)에서만 채우는 선행 정렬 키.
   * Project.cohortOrder 값이다. 규칙이 바뀌기 전에 발급된 커서에는 없으므로 optional.
   */
  cohortOrder?: number;
};

export const encodeCursor = (claim: CursorClaim): string => {
  return Buffer.from(JSON.stringify(claim), 'utf8').toString('base64url');
};

/**
 * 커서는 클라이언트가 그대로 돌려보내는 값이라 여기가 신뢰 경계다.
 * typeof 만 보면 Infinity(1e400)·소수·안전 범위를 넘는 정수가 그대로 통과해 쿼리 파라미터로 나가고,
 * 드라이버나 Postgres 가 '1.5'/'Infinity' 를 int·timestamp 로 바꾸다 터진다.
 * 인증 없이 호출되는 목록이라 그대로 두면 누구나 500 을 만들 수 있다.
 */
const isCursorKey = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value);

export const decodeCursor = (cursor: string): CursorClaim | null => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<CursorClaim>;
    if (!isCursorKey(parsed.createdAt) || !isCursorKey(parsed.id)) {
      return null;
    }
    if (parsed.cohortOrder !== undefined && !isCursorKey(parsed.cohortOrder)) {
      return null;
    }
    return parsed.cohortOrder === undefined
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : { createdAt: parsed.createdAt, id: parsed.id, cohortOrder: parsed.cohortOrder };
  } catch {
    return null;
  }
};

export const resolveLimit = (requested?: number): number => {
  if (requested === undefined || requested <= 0) {
    return DEFAULT_CURSOR_LIMIT;
  }
  return Math.min(requested, MAX_CURSOR_LIMIT);
};
