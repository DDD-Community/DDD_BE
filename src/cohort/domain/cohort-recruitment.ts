import { toKstDayEnd, toKstDayStart } from '../../common/util/kst-date';
import { CohortStatus } from './cohort.status';

/**
 * 모집 일정은 한국 날짜 감각으로 입력되지만 값은 UTC 로 저장된다(예: 2026-09-21T00:00:00Z).
 * 저장된 시각을 그대로 비교하면 한국시간 오전 9시가 하루의 경계가 되어
 * "9월 21일부터 9월 30일까지"가 실제로는 9/21 09:00 ~ 10/1 09:00 이 된다.
 * 그래서 시작도 종료도 저장값이 가리키는 한국 날짜의 경계로 환산해 비교한다.
 * 상태 전환 스케줄러도 같은 기준(Asia/Seoul 자정)을 쓰므로 둘이 어긋나지 않는다.
 */

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
  const started = toKstDayStart({ date: recruitStartAt }).getTime() <= current;
  const notEnded = current <= toKstDayEnd({ date: recruitEndAt }).getTime();
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

  return now.getTime() < toKstDayStart({ date: recruitStartAt }).getTime();
};
