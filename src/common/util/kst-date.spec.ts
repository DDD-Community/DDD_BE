import { kstTodayStoredRange, toKstDayEnd, toKstDayStart } from './kst-date';

describe('toKstDayStart', () => {
  it('UTC 자정으로 저장된 값은 같은 날짜의 한국 자정이 된다', () => {
    // Given: 어드민이 날짜만 고를 때 저장되는 형태
    const date = new Date('2026-09-21T00:00:00.000Z');

    // When
    const result = toKstDayStart({ date });

    // Then: 한국시간 9/21 00:00
    expect(result.toISOString()).toBe('2026-09-20T15:00:00.000Z');
  });

  it('같은 날짜를 23:59:59 로 저장해도 같은 한국 자정이 된다', () => {
    // Given: 저장값에서 의미를 갖는 것은 시각이 아니라 달력 날짜다
    const date = new Date('2026-09-21T23:59:59.000Z');

    // When
    const result = toKstDayStart({ date });

    // Then
    expect(result.toISOString()).toBe('2026-09-20T15:00:00.000Z');
  });

  it('월 경계에서도 날짜가 밀리지 않는다', () => {
    // Given
    const date = new Date('2026-03-01T00:00:00.000Z');

    // When
    const result = toKstDayStart({ date });

    // Then: 한국시간 3/1 00:00
    expect(result.toISOString()).toBe('2026-02-28T15:00:00.000Z');
  });
});

describe('toKstDayEnd', () => {
  it('UTC 자정으로 저장된 값은 같은 날짜의 한국 하루 끝이 된다', () => {
    // Given
    const date = new Date('2026-09-30T00:00:00.000Z');

    // When
    const result = toKstDayEnd({ date });

    // Then: 한국시간 9/30 23:59:59.999
    expect(result.toISOString()).toBe('2026-09-30T14:59:59.999Z');
  });

  it('같은 날짜를 23:59:59 로 저장해도 같은 한국 하루 끝이 된다', () => {
    // Given
    const date = new Date('2026-09-30T23:59:59.000Z');

    // When
    const result = toKstDayEnd({ date });

    // Then
    expect(result.toISOString()).toBe('2026-09-30T14:59:59.999Z');
  });

  it('하루의 시작과 끝은 정확히 하루에서 1밀리초 모자란 간격이다', () => {
    // Given
    const date = new Date('2026-09-30T00:00:00.000Z');

    // When
    const gap = toKstDayEnd({ date }).getTime() - toKstDayStart({ date }).getTime();

    // Then
    expect(gap).toBe(24 * 60 * 60 * 1000 - 1);
  });
});

describe('kstTodayStoredRange', () => {
  it('한국시간 자정에는 그날의 저장값 범위를 돌려준다', () => {
    // Given: 한국시간 9/21 00:00 (스케줄러가 도는 시각)
    const now = new Date('2026-09-20T15:00:00.000Z');

    // When
    const result = kstTodayStoredRange({ now });

    // Then: 9/21 로 저장된 값은 00:00:00Z 든 23:59:59Z 든 이 범위에 들어온다
    expect(result.start.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(result.end.toISOString()).toBe('2026-09-21T23:59:59.999Z');
  });

  it('한국시간 자정 직전에는 아직 전날 범위다', () => {
    // Given: 한국시간 9/20 23:59:59
    const now = new Date('2026-09-20T14:59:59.000Z');

    // When
    const result = kstTodayStoredRange({ now });

    // Then
    expect(result.start.toISOString()).toBe('2026-09-20T00:00:00.000Z');
  });

  it('UTC 로는 전날이어도 한국 날짜 기준으로 오늘을 잡는다', () => {
    // Given: UTC 9/20 18:00 = 한국시간 9/21 03:00
    const now = new Date('2026-09-20T18:00:00.000Z');

    // When
    const result = kstTodayStoredRange({ now });

    // Then
    expect(result.start.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });
});
