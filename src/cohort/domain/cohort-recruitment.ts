import { CohortStatus } from './cohort.status';

/**
 * 모집 개폐 판정에 필요한 최소 정보.
 * 엔티티 전체가 아니라 이 형태만 요구해 파트 relation 등 부분 로드된 객체도 그대로 넘길 수 있다.
 */
export type CohortRecruitmentWindow = {
  status: CohortStatus;
  recruitStartAt?: Date | null;
  recruitEndAt?: Date | null;
};

/**
 * 모집 종료일은 "그날까지 모집"을 뜻하므로 저장된 시각이 아니라 그날의 끝을 마감으로 본다.
 * 어드민이 날짜만 고르면 00:00:00 으로 저장되는데(예: 2026-09-05T00:00:00Z),
 * 그 시각을 그대로 마감으로 쓰면 마지막 하루가 통째로 사라진다.
 */
const endOfUtcDay = (date: Date): Date => {
  const end = new Date(date);
  end.setUTCHours(23, 59, 59, 999);
  return end;
};

/**
 * 지원 접수가 열려 있는지 판정한다.
 * status 만으로 판단하면 모집 시작 전·종료 후에도 접수가 열리므로 모집 일정까지 함께 본다.
 * 일정이 비어 있으면 닫힌 것으로 본다(fail-closed).
 */
export const isRecruitmentOpenAt = ({
  cohort,
  now,
}: {
  cohort: CohortRecruitmentWindow;
  now: Date;
}): boolean => {
  if (cohort.status !== CohortStatus.RECRUITING) {
    return false;
  }

  const { recruitStartAt, recruitEndAt } = cohort;
  if (!recruitStartAt || !recruitEndAt) {
    return false;
  }

  const current = now.getTime();
  const started = recruitStartAt.getTime() <= current;
  const notEnded = current <= endOfUtcDay(recruitEndAt).getTime();
  return started && notEnded;
};

/** 모집 시작 전 구간인지 판정한다. 사전 알림 CTA 노출 여부에 쓴다. */
export const isBeforeRecruitStart = ({
  cohort,
  now,
}: {
  cohort: CohortRecruitmentWindow;
  now: Date;
}): boolean => {
  const { recruitStartAt } = cohort;
  if (!recruitStartAt) {
    return false;
  }

  return now.getTime() < recruitStartAt.getTime();
};
