export const ErrorMessage = {
  INTERNAL_SERVER_ERROR: '서버 내부 오류가 발생했습니다.',
  UNAUTHORIZED: '인증이 필요합니다.',
  FORBIDDEN: '접근 권한이 없습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  BAD_REQUEST: '잘못된 요청입니다.',

  USER_NOT_FOUND: '사용자를 찾을 수 없습니다.',
  GOOGLE_AUTH_FAILED: '구글 인증 정보를 가져올 수 없습니다.',

  COHORT_NOT_FOUND: '기수를 찾을 수 없습니다.',
  COHORT_ALREADY_EXISTS: '이미 진행 중인 기수가 존재합니다.',

  APPLICATION_FORM_NOT_FOUND: '지원서를 찾을 수 없습니다.',
  COHORT_PART_CLOSED: '모집이 마감되었거나 존재하지 않는 파트입니다.',
  PRIVACY_AGREEMENT_REQUIRED: '개인정보 수집 및 이용에 동의해야 합니다.',
  INVALID_APPLICATION_ANSWERS: '지원서 필수 항목이 누락되었습니다.',
  ALREADY_SUBMITTED: '이미 제출된 지원서가 존재합니다.',
  APPLICATION_NOT_FOUND: '해당 지원서를 찾을 수 없습니다.',
  APPLICATION_DRAFT_NOT_FOUND: '해당 임시저장 지원서를 찾을 수 없습니다.',
  INVALID_STATUS_TRANSITION: '올바르지 않은 상태 변경입니다.',

  EVALUATION_NOT_FOUND: '평가 정보를 찾을 수 없습니다.',

  INTERVIEW_SLOT_NOT_FOUND: '면접 슬롯을 찾을 수 없습니다.',
  INTERVIEW_SLOT_ALREADY_RESERVED: '이미 예약된 면접 슬롯입니다.',

  BLOG_POST_NOT_FOUND: '블로그 게시글을 찾을 수 없습니다.',
} as const;

export type ErrorMessageKey = keyof typeof ErrorMessage;
