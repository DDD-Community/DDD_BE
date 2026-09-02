import { diffMinutes, formatKoreanDateTime, formatKoreanDeadline } from './format-korean-date';

describe('formatKoreanDeadline', () => {
  it('날짜만 있으면 월/일(요일) 로 표기한다', () => {
    expect(formatKoreanDeadline('2026-09-18')).toBe('9월 18일(금)');
  });

  it('시각까지 있으면 오전/오후를 붙인다', () => {
    expect(formatKoreanDeadline('2026-09-18T23:59:00+09:00')).toContain('9월 18일');
    expect(formatKoreanDeadline('2026-09-18T23:59:00+09:00')).toContain('오후');
  });

  it('해석되지 않는 값은 원문을 그대로 돌려준다', () => {
    // 운영진이 "9월 18일 자정까지" 처럼 문장으로 적어둘 수 있다.
    expect(formatKoreanDeadline('9월 18일 자정')).toBe('9월 18일 자정');
  });

  it.each(['2026-09-18T23:59', '2026-09-18 23:59', '2026-09-18 23:59:00'])(
    '오프셋 없는 값(%s)은 서버 타임존과 무관하게 KST 로 해석한다',
    (input) => {
      // 컨테이너는 UTC 라, 로컬 해석에 맡기면 기한이 하루 밀린 채 안내된다.
      const result = formatKoreanDeadline(input);

      expect(result).toContain('9월 18일');
      expect(result).toContain('오후 11:59');
    },
  );

  it('오프셋이 명시된 값은 그대로 해석한다', () => {
    expect(formatKoreanDeadline('2026-09-18T14:59:00Z')).toContain('9월 18일');
    expect(formatKoreanDeadline('2026-09-18T14:59:00Z')).toContain('오후 11:59');
  });

  it.each(['2026-9-13', '2026/09/13', 'Sep 13 2026'])(
    '느슨한 날짜 표기(%s)는 임의 해석하지 않고 원문을 돌려준다',
    (input) => {
      expect(formatKoreanDeadline(input)).toBe(input);
    },
  );

  it('앞뒤 공백은 잘라낸다', () => {
    expect(formatKoreanDeadline('  2026-09-18  ')).toBe('9월 18일(금)');
  });
});

describe('formatKoreanDateTime', () => {
  it('KST 기준으로 날짜와 시각을 함께 표기한다', () => {
    const result = formatKoreanDateTime(new Date('2026-09-19T05:00:00Z')); // KST 14:00

    expect(result).toContain('9월 19일');
    expect(result).toContain('오후 2:00');
  });
});

describe('diffMinutes', () => {
  it('시작~종료 길이를 분으로 계산한다', () => {
    expect(
      diffMinutes({
        startAt: new Date('2026-09-19T05:00:00Z'),
        endAt: new Date('2026-09-19T05:30:00Z'),
      }),
    ).toBe(30);
  });

  it('종료가 시작보다 이르면 0 을 돌려준다', () => {
    expect(
      diffMinutes({
        startAt: new Date('2026-09-19T06:00:00Z'),
        endAt: new Date('2026-09-19T05:00:00Z'),
      }),
    ).toBe(0);
  });
});
