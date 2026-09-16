export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

export type CursorClaim = {
  createdAt: number;
  id: number;
  /**
   * 기수 순으로 정렬하는 목록(프로젝트)에서만 채우는 선행 정렬 키.
   * projects.cohortId 를 그대로 쓴다. 기수 순 정렬 도입 전에 발급된 커서에는 없으므로 optional.
   */
  cohortId?: number;
};

export const encodeCursor = (claim: CursorClaim): string => {
  return Buffer.from(JSON.stringify(claim), 'utf8').toString('base64url');
};

export const decodeCursor = (cursor: string): CursorClaim | null => {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const parsed = JSON.parse(raw) as Partial<CursorClaim>;
    if (typeof parsed.createdAt !== 'number' || typeof parsed.id !== 'number') {
      return null;
    }
    if (parsed.cohortId !== undefined && typeof parsed.cohortId !== 'number') {
      return null;
    }
    return parsed.cohortId === undefined
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : { createdAt: parsed.createdAt, id: parsed.id, cohortId: parsed.cohortId };
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
