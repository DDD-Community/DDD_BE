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

    it('기수 정렬 키가 붙은 claim도 그대로 복원한다', () => {
      const claim = { createdAt: 1700000000000, id: 42, cohortOrder: 13 };
      expect(decodeCursor(encodeCursor(claim))).toEqual(claim);
    });

    it('기수 정렬 키가 숫자가 아니면 null을 반환한다', () => {
      const junk = Buffer.from(
        JSON.stringify({ createdAt: 1, id: 2, cohortOrder: '13기' }),
        'utf8',
      ).toString('base64url');
      expect(decodeCursor(junk)).toBeNull();
    });

    // 커서는 클라이언트가 돌려보내는 값이라 여기서 안 걸러지면 그대로 쿼리 파라미터가 된다.
    // 인증 없는 목록이라 아래 값들이 통과하면 누구나 500 을 만들 수 있다.
    // 실제 공격 벡터와 같게 JSON 문자열을 그대로 싣는다.
    // JS 리터럴로 쓰면 1e400 이 Infinity 로 접히면서 무엇을 막는 테스트인지 흐려진다.
    it.each([
      ['Infinity 로 접히는 지수', '{"createdAt":1,"id":2,"cohortOrder":1e400}'],
      ['소수 id', '{"createdAt":1,"id":1.5}'],
      ['Infinity createdAt', '{"createdAt":1e400,"id":2}'],
      ['안전 정수를 넘는 값', '{"createdAt":1,"id":9007199254740993}'],
    ])('정수가 아닌 %s 는 null을 반환한다', (_label, json) => {
      const token = Buffer.from(json, 'utf8').toString('base64url');
      expect(decodeCursor(token)).toBeNull();
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
