import type { AnnouncementStatus } from './application.status';
import { ApplicationStatus } from './application.status';

/**
 * 어드민이 미리 받아 볼 수 있는 지원자 안내 메일 종류.
 * 결과 안내 4종은 ANNOUNCEMENT_STATUSES 와 같은 값을 쓰고, 접수 안내만 따로 둔다.
 */
export enum TestEmailType {
  지원접수 = '지원접수',
  서류합격 = '서류합격',
  서류불합격 = '서류불합격',
  면접합격 = '면접합격',
  최종불합격 = '최종불합격',
}

/** 결과 안내 메일 종류 → 실제 발송 경로가 쓰는 전형 단계 */
export const ANNOUNCEMENT_STATUS_BY_TEST_EMAIL_TYPE: Record<
  Exclude<TestEmailType, TestEmailType.지원접수>,
  AnnouncementStatus
> = {
  [TestEmailType.서류합격]: ApplicationStatus.서류합격,
  [TestEmailType.서류불합격]: ApplicationStatus.서류불합격,
  [TestEmailType.면접합격]: ApplicationStatus.면접합격,
  [TestEmailType.최종불합격]: ApplicationStatus.최종불합격,
};
