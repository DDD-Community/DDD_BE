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
 *
 * 최종합격은 빠져 있다. 전이 흐름이 면접합격 -> 최종합격 -> 활동중 이라,
 * 지원자에게 합격과 참가비를 안내하는 시점은 면접합격이고 최종합격은 운영진이
 * 입금·참여 의사를 확인해 올리는 내부 단계다. 여기서 또 메일을 보내면
 * 이미 입금한 사람에게 같은 안내가 한 번 더 간다.
 *
 * 활동 상태(활동중/활동완료/활동중단)도 기수 운영 결과라 개별 통보 대상이 아니다.
 */
export const ANNOUNCEMENT_STATUSES = [
  ApplicationStatus.서류합격,
  ApplicationStatus.서류불합격,
  ApplicationStatus.면접합격,
  ApplicationStatus.최종불합격,
] as const;

export type AnnouncementStatus = (typeof ANNOUNCEMENT_STATUSES)[number];

export const isAnnouncementStatus = (status: ApplicationStatus): status is AnnouncementStatus =>
  (ANNOUNCEMENT_STATUSES as readonly ApplicationStatus[]).includes(status);
