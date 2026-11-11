import {
  CommonSwaggerResponses,
  errorResponseSchema,
  successListResponseSchema,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import {
  AttendanceBoardResponseDto,
  AttendanceGenerationResponseDto,
  AttendanceInvitationResponseDto,
  AttendanceTeamResponseDto,
  AttendanceVoteDetailResponseDto,
  AttendanceVoteFeedbackResultsResponseDto,
  AttendanceVoteNonRespondersResponseDto,
  AttendanceVoteParticipationResponseDto,
  AttendanceVoteSummaryResponseDto,
  AttendanceVoteTeamResultsResponseDto,
} from './dto/admin-attendance.response.dto';

const unauthorized = CommonSwaggerResponses.unauthorized(
  'access_token 쿠키가 없거나 만료되었습니다.',
);
const notFound = CommonSwaggerResponses.notFound(
  '출석 리소스를 찾을 수 없습니다.',
  'ATTENDANCE_NOT_FOUND',
);
const conflictCodes = [
  'ATTENDANCE_GENERATION_IN_USE',
  'ATTENDANCE_TEAM_IN_USE',
  'ATTENDANCE_GENERATION_DUPLICATED',
  'ATTENDANCE_TEAM_DUPLICATED',
  'ATTENDANCE_INVITATION_DUPLICATED',
  'ATTENDANCE_SCHEDULE_DATE_CONFLICT',
  'ATTENDANCE_VOTE_NOT_DRAFT',
  'ATTENDANCE_VOTE_NOT_OPEN',
  'ATTENDANCE_VOTE_INVALID_STATUS',
  'ATTENDANCE_VOTE_ALREADY_OPEN',
  'ATTENDANCE_CONFLICT',
];
const conflict = {
  status: 409,
  description: '출석 리소스의 충돌입니다.',
  schema: {
    type: 'object',
    properties: {
      code: { type: 'string', enum: conflictCodes, example: conflictCodes[0] },
      message: { type: 'string', example: '출석 리소스의 충돌입니다.' },
      data: { type: 'object', nullable: true, example: null },
    },
  },
};
const notConfigured = {
  status: 503,
  description: '출석 서비스 연동 설정이 없습니다.',
  ...errorResponseSchema('ATTENDANCE_NOT_CONFIGURED', '출석 서비스 연동 설정이 없습니다.'),
};
const upstreamError = {
  status: 502,
  description: '출석 서비스 요청에 실패했습니다.',
  ...errorResponseSchema('ATTENDANCE_UPSTREAM_ERROR', '출석 서비스 요청에 실패했습니다.'),
};
const badRequest = {
  status: 400,
  description: '요청 값이 올바르지 않습니다.',
  ...errorResponseSchema('ATTENDANCE_BAD_REQUEST', '요청 값이 올바르지 않습니다.'),
};
const voteBadRequest = {
  status: 400,
  description: '투표 요청 값이나 템플릿이 올바르지 않습니다.',
  schema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        enum: [
          'ATTENDANCE_BAD_REQUEST',
          'ATTENDANCE_VOTE_TEMPLATE_INVALID',
          'ATTENDANCE_VOTE_TEMPLATE_STRUCTURE_CHANGED',
        ],
      },
      message: { type: 'string' },
      data: { type: 'object', nullable: true, example: null },
    },
  },
};
const baseResponses = [unauthorized, notConfigured, upstreamError];
const requestResponses = [badRequest, ...baseResponses];
const generationResponses = [...requestResponses, notFound];
const createResponses = [...generationResponses, conflict];
const deleteResponses = [...requestResponses, notFound, conflict];

export const AdminAttendanceSwagger = {
  getGenerations: {
    success: {
      status: 200,
      description: '출석 기수 목록 조회 성공.',
      ...successListResponseSchema(AttendanceGenerationResponseDto),
    },
    responses: requestResponses,
  },
  createGeneration: {
    success: {
      status: 200,
      description: '출석 기수 생성 성공.',
      ...successResponseSchema(AttendanceGenerationResponseDto),
    },
    responses: createResponses,
  },
  deleteGeneration: {
    noContent: { status: 204, description: '출석 기수 삭제 성공.' },
    responses: deleteResponses,
  },
  getTeams: {
    success: {
      status: 200,
      description: '출석 팀 목록 조회 성공.',
      ...successListResponseSchema(AttendanceTeamResponseDto),
    },
    responses: generationResponses,
  },
  createTeam: {
    success: {
      status: 200,
      description: '출석 팀 생성 성공.',
      ...successResponseSchema(AttendanceTeamResponseDto),
    },
    responses: createResponses,
  },
  deleteTeam: {
    noContent: { status: 204, description: '출석 팀 삭제 성공.' },
    responses: deleteResponses,
  },
  getInvitations: {
    success: {
      status: 200,
      description: '출석 초대코드 목록 조회 성공.',
      ...successListResponseSchema(AttendanceInvitationResponseDto),
    },
    responses: generationResponses,
  },
  createInvitation: {
    success: {
      status: 200,
      description: '출석 초대코드 생성 성공.',
      ...successResponseSchema(AttendanceInvitationResponseDto),
    },
    responses: createResponses,
  },
  deleteInvitation: {
    noContent: { status: 204, description: '출석 초대코드 삭제 성공.' },
    responses: deleteResponses,
  },
  getBoard: {
    success: {
      status: 200,
      description: '출석 보드 조회 성공.',
      ...successResponseSchema(AttendanceBoardResponseDto),
    },
    responses: generationResponses,
  },
  exportBoard: {
    success: {
      status: 200,
      description: '출석 보드 CSV 내보내기 성공.',
      content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
    },
    responses: generationResponses,
  },
  getVotes: {
    success: {
      status: 200,
      description: '투표 목록 조회 성공.',
      ...successListResponseSchema(AttendanceVoteSummaryResponseDto),
    },
    responses: generationResponses,
  },
  createVote: {
    success: {
      status: 200,
      description: '투표 생성 성공.',
      ...successResponseSchema(AttendanceVoteDetailResponseDto),
    },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  getVote: {
    success: {
      status: 200,
      description: '투표 상세 조회 성공.',
      ...successResponseSchema(AttendanceVoteDetailResponseDto),
    },
    responses: generationResponses,
  },
  updateVote: {
    success: {
      status: 200,
      description: '투표 수정 성공.',
      ...successResponseSchema(AttendanceVoteDetailResponseDto),
    },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  deleteVote: {
    noContent: { status: 204, description: '투표 삭제 성공.' },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  openVote: {
    success: {
      status: 200,
      description: '투표 시작 성공.',
      ...successResponseSchema(AttendanceVoteDetailResponseDto),
    },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  closeVote: {
    success: {
      status: 200,
      description: '투표 종료 성공.',
      ...successResponseSchema(AttendanceVoteDetailResponseDto),
    },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  getVoteParticipation: {
    success: {
      status: 200,
      description: '투표 참여 현황 조회 성공.',
      ...successResponseSchema(AttendanceVoteParticipationResponseDto),
    },
    responses: generationResponses,
  },
  getVoteNonResponders: {
    success: {
      status: 200,
      description: '투표 미응답자 조회 성공.',
      ...successResponseSchema(AttendanceVoteNonRespondersResponseDto),
    },
    responses: generationResponses,
  },
  getVoteTeamResults: {
    success: {
      status: 200,
      description: '팀 투표 결과 조회 성공.',
      ...successResponseSchema(AttendanceVoteTeamResultsResponseDto),
    },
    responses: generationResponses,
  },
  getVoteFeedbackResults: {
    success: {
      status: 200,
      description: '피드백 결과 조회 성공.',
      ...successResponseSchema(AttendanceVoteFeedbackResultsResponseDto),
    },
    responses: generationResponses,
  },
  vote: {
    success: { status: 200, description: '투표 요청 성공.', schema: { type: 'object' } },
    noContent: { status: 204, description: '투표 삭제 성공.' },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
  exportVote: {
    success: {
      status: 200,
      description: '투표 CSV 내보내기 성공.',
      content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
    },
    responses: [voteBadRequest, ...baseResponses, notFound, conflict],
  },
} as const;
