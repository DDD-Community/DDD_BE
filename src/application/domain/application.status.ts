export enum ApplicationStatus {
  서류심사대기 = '서류심사대기',
  서류합격 = '서류합격',
  서류불합격 = '서류불합격',
  면접합격 = '면접합격',
  최종합격 = '최종합격',
  최종불합격 = '최종불합격',
  활동중 = '활동중',
  활동완료 = '활동완료',
  활동중단 = '활동중단',
}

/**
 * 지원자에게 결과 안내 메일이 나가는 전형 단계.
 * 활동 상태(활동중/활동완료/활동중단)는 기수 운영 결과라 개별 통보 대상이 아니다.
 */
export const ANNOUNCEMENT_STATUSES = [
  ApplicationStatus.서류합격,
  ApplicationStatus.서류불합격,
  ApplicationStatus.면접합격,
  ApplicationStatus.최종합격,
  ApplicationStatus.최종불합격,
] as const;

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const isAnnouncementStatus = (status: ApplicationStatus): status is AnnouncementStatus =>
  (ANNOUNCEMENT_STATUSES as readonly ApplicationStatus[]).includes(status);
