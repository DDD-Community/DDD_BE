import {
  decodeCursor,
  DEFAULT_CURSOR_LIMIT,
  encodeCursor,
  MAX_CURSOR_LIMIT,
  resolveLimit,
} from './cursor';

describe('cursor util', () => {
  describe('encode/decode', () => {
    it('encode 후 decode 시 동일한 claim을 복원한다', () => {
      const claim = { createdAt: 1700000000000, id: 42 };
      const encoded = encodeCursor(claim);
      expect(decodeCursor(encoded)).toEqual(claim);
    });

    it('형식 불일치 토큰은 null을 반환한다', () => {
      expect(decodeCursor('invalid-base64')).toBeNull();
    });

    it('JSON 구조 불일치 토큰은 null을 반환한다', () => {
      const junk = Buffer.from(JSON.stringify({ foo: 'bar' }), 'utf8').toString('base64url');
      expect(decodeCursor(junk)).toBeNull();
    });
  });

  describe('resolveLimit', () => {
    it('undefined이면 기본값을 반환한다', () => {
      expect(resolveLimit(undefined)).toBe(DEFAULT_CURSOR_LIMIT);
    });

    it('0 이하 값이면 기본값을 반환한다', () => {
      expect(resolveLimit(0)).toBe(DEFAULT_CURSOR_LIMIT);
      expect(resolveLimit(-5)).toBe(DEFAULT_CURSOR_LIMIT);
    });

    it('최대값을 초과하면 최대값으로 제한한다', () => {
      expect(resolveLimit(500)).toBe(MAX_CURSOR_LIMIT);
    });

    it('유효 범위 값은 그대로 반환한다', () => {
      expect(resolveLimit(50)).toBe(50);
    });
  });
});
