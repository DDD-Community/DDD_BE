import { plainToInstance } from 'class-transformer';

import { CohortStatus } from '../../domain/cohort.status';
import { isRecruitmentOpenAt } from '../../domain/cohort-recruitment';
import { CreateCohortRequestDto, UpdateCohortRequestDto } from './admin-cohort.request.dto';

// 운영진이 "9/21 ~ 9/30 모집"을 적는 여러 방식. 어느 쪽으로 적어도 같은 한국 날짜여야 한다.
const START_INPUTS = [
  ['날짜만', '2026-09-21'],
  ['UTC 자정', '2026-09-21T00:00:00Z'],
  ['UTC 하루의 끝', '2026-09-21T23:59:59Z'],
  ['한국 자정', '2026-09-21T00:00:00+09:00'],
  ['한국 오후', '2026-09-21T14:00:00+09:00'],
] as const;

describe('CreateCohortRequestDto 일정 변환', () => {
  it.each(START_INPUTS)('%s(%s)로 적어도 같은 날짜로 변환된다', (_label, input) => {
    // Given / When
    const dto = plainToInstance(CreateCohortRequestDto, { recruitStartAt: input });

    // Then
    expect(dto.recruitStartAt.toISOString()).toBe('2026-09-21T00:00:00.000Z');
  });

  it.each(START_INPUTS)('%s(%s)로 적으면 한국시간 9/21 자정부터 모집이 열린다', (_label, input) => {
    // Given
    const dto = plainToInstance(CreateCohortRequestDto, {
      recruitStartAt: input,
      recruitEndAt: '2026-09-30',
    });
    const cohort = {
      status: CohortStatus.RECRUITING,
      recruitStartAt: dto.recruitStartAt,
      recruitEndAt: dto.recruitEndAt,
    };

    // When — 한국시간 9/21 00:00 과 그 직전
    const atMidnight = new Date('2026-09-20T15:00:00.000Z');
    const justBefore = new Date('2026-09-20T14:59:59.999Z');

    // Then
    expect(isRecruitmentOpenAt({ cohort, now: atMidnight })).toBe(true);
    expect(isRecruitmentOpenAt({ cohort, now: justBefore })).toBe(false);
  });

  it('한국 자정으로 적은 모집 종료일이 하루 앞당겨지지 않는다', () => {
    // Given — Date 로 바꾸면 UTC 9/29 15:00 이 되어 날짜가 밀리던 입력
    const dto = plainToInstance(CreateCohortRequestDto, {
      recruitStartAt: '2026-09-21T00:00:00+09:00',
      recruitEndAt: '2026-09-30T00:00:00+09:00',
    });
    const cohort = {
      status: CohortStatus.RECRUITING,
      recruitStartAt: dto.recruitStartAt,
      recruitEndAt: dto.recruitEndAt,
    };

    // When / Then — 한국시간 9/30 마지막 순간까지 열려 있고 10/1 자정에 닫힌다
    expect(isRecruitmentOpenAt({ cohort, now: new Date('2026-09-30T14:59:59.999Z') })).toBe(true);
    expect(isRecruitmentOpenAt({ cohort, now: new Date('2026-09-30T15:00:00.000Z') })).toBe(false);
  });

  it('활동 종료일도 같은 규칙으로 변환된다', () => {
    // Given / When
    const dto = plainToInstance(CreateCohortRequestDto, {
      activityEndAt: '2026-06-30T00:00:00+09:00',
    });

    // Then
    expect(dto.activityEndAt?.toISOString()).toBe('2026-06-30T00:00:00.000Z');
  });
});

describe('UpdateCohortRequestDto 일정 변환', () => {
  it('수정 요청에도 같은 규칙이 적용된다', () => {
    // Given / When
    const dto = plainToInstance(UpdateCohortRequestDto, {
      recruitStartAt: '2026-09-21T00:00:00+09:00',
      recruitEndAt: '2026-09-30T23:59:59Z',
    });

    // Then
    expect(dto.recruitStartAt?.toISOString()).toBe('2026-09-21T00:00:00.000Z');
    expect(dto.recruitEndAt?.toISOString()).toBe('2026-09-30T00:00:00.000Z');
  });

  it('활동 종료일 예약 해제(null)는 그대로 통과시킨다', () => {
    // Given / When
    const dto = plainToInstance(UpdateCohortRequestDto, { activityEndAt: null });

    // Then
    expect(dto.activityEndAt).toBeNull();
  });
});
