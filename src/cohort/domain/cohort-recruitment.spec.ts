import { CohortStatus } from './cohort.status';
import type { CohortRecruitmentWindow } from './cohort-recruitment';
import { isBeforeRecruitStart, isRecruitmentOpenAt } from './cohort-recruitment';

const RECRUIT_START_AT = new Date('2026-08-29T00:00:00.000Z');
const RECRUIT_END_AT = new Date('2026-09-05T00:00:00.000Z');

const createWindow = (
  override: Partial<CohortRecruitmentWindow> = {},
): CohortRecruitmentWindow => ({
  status: CohortStatus.RECRUITING,
  recruitStartAt: RECRUIT_START_AT,
  recruitEndAt: RECRUIT_END_AT,
  ...override,
});

describe('isRecruitmentOpenAt', () => {
  it('RECRUITING 이고 모집 기간 안이면 열려 있다', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(true);
  });

  it('RECRUITING 이어도 모집 시작 전이면 닫혀 있다', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(false);
  });

  it('RECRUITING 이어도 모집 종료 후면 닫혀 있다', () => {
    const now = new Date('2026-09-06T00:00:00.000Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(false);
  });

  it('모집 시작 시각 정각은 열려 있다', () => {
    expect(isRecruitmentOpenAt({ cohort: createWindow(), now: RECRUIT_START_AT })).toBe(true);
  });

  it('모집 종료 시각 정각은 열려 있다', () => {
    expect(isRecruitmentOpenAt({ cohort: createWindow(), now: RECRUIT_END_AT })).toBe(true);
  });

  it('모집 종료일이 00:00 으로 저장돼 있어도 그날 하루는 열려 있다', () => {
    const now = new Date('2026-09-05T12:00:00.000Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(true);
  });

  it('모집 종료일의 마지막 순간까지 열려 있다', () => {
    const now = new Date('2026-09-05T23:59:59.999Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(true);
  });

  it('모집 종료일 다음 날 0시에는 닫혀 있다', () => {
    const now = new Date('2026-09-06T00:00:00.000Z');

    expect(isRecruitmentOpenAt({ cohort: createWindow(), now })).toBe(false);
  });

  it('종료 시각이 23:59:59 로 저장돼 있어도 그날까지만 열려 있다', () => {
    const cohort = createWindow({ recruitEndAt: new Date('2026-09-05T23:59:59.000Z') });

    expect(isRecruitmentOpenAt({ cohort, now: new Date('2026-09-05T23:59:59.500Z') })).toBe(true);
    expect(isRecruitmentOpenAt({ cohort, now: new Date('2026-09-06T00:00:00.000Z') })).toBe(false);
  });

  it('RECRUITING 이 아니면 모집 기간 안이어도 닫혀 있다', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    const cohort = createWindow({ status: CohortStatus.UPCOMING });

    expect(isRecruitmentOpenAt({ cohort, now })).toBe(false);
  });

  it('모집 일정이 비어 있으면 닫혀 있다', () => {
    const now = new Date('2026-09-01T00:00:00.000Z');
    const cohort = createWindow({ recruitStartAt: undefined, recruitEndAt: undefined });

    expect(isRecruitmentOpenAt({ cohort, now })).toBe(false);
  });
});

describe('isBeforeRecruitStart', () => {
  it('모집 시작 전이면 true 를 반환한다', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');

    expect(isBeforeRecruitStart({ cohort: createWindow(), now })).toBe(true);
  });

  it('모집 시작 시각 정각이면 false 를 반환한다', () => {
    expect(isBeforeRecruitStart({ cohort: createWindow(), now: RECRUIT_START_AT })).toBe(false);
  });

  it('모집 시작일이 비어 있으면 false 를 반환한다', () => {
    const now = new Date('2026-08-16T00:00:00.000Z');
    const cohort = createWindow({ recruitStartAt: undefined });

    expect(isBeforeRecruitStart({ cohort, now })).toBe(false);
  });
});
