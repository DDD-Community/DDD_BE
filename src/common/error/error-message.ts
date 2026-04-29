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
  INTERVIEW_SLOTS_NOT_READY: '해당 파트의 면접 슬롯이 준비되지 않아 서류합격 처리할 수 없습니다.',
  INVALID_INTERVIEW_SLOT_RANGE: '면접 슬롯의 종료 시간은 시작 시간보다 늦어야 합니다.',

  BLOG_POST_NOT_FOUND: '블로그 게시글을 찾을 수 없습니다.',

  PROJECT_NOT_FOUND: '프로젝트를 찾을 수 없습니다.',

  EARLY_NOTIFICATION_CONFLICT: '사전 알림 처리 중 일시적인 충돌이 발생했습니다. 다시 시도해주세요.',

  FILE_NOT_PROVIDED: '업로드할 파일이 없습니다.',
  FILE_TYPE_NOT_ALLOWED: '허용되지 않는 파일 형식입니다.',
  FILE_SIZE_EXCEEDED: '파일 크기가 제한을 초과했습니다.',
  FILE_UPLOAD_FAILED: '파일 업로드에 실패했습니다.',
  FILE_NOT_FOUND: '파일을 찾을 수 없습니다.',
  FILE_DELETE_FAILED: '파일 삭제에 실패했습니다.',
  FILE_LIST_FAILED: '파일 목록 조회에 실패했습니다.',
  FILE_DOWNLOAD_FAILED: '파일 다운로드에 실패했습니다.',
  SIGNED_URL_GENERATION_FAILED: '서명 URL 생성에 실패했습니다.',
  STORAGE_NOT_CONFIGURED: '스토리지가 설정되지 않았습니다.',
  INVALID_FILE_PATH: '유효하지 않은 파일 경로입니다.',

  DISCORD_OAUTH_FAILED: 'Discord 인증 정보를 가져올 수 없습니다.',
  DISCORD_GUILD_ADD_FAILED: 'Discord 서버에 합류시키는 데 실패했습니다.',
  DISCORD_ALREADY_LINKED: '이미 Discord 계정이 연동된 지원서입니다.',
  DISCORD_LINK_NOT_FOUND: 'Discord 연동 정보를 찾을 수 없습니다.',
  DISCORD_NOT_CONFIGURED: 'Discord 연동이 설정되지 않았습니다.',
} as const;

export type ErrorMessageKey = keyof typeof ErrorMessage;
