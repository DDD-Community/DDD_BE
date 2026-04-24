export const DEFAULT_CURSOR_LIMIT = 20;
export const MAX_CURSOR_LIMIT = 100;

export type CursorClaim = {
  createdAt: number;
  id: number;
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
    return { createdAt: parsed.createdAt, id: parsed.id };
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
