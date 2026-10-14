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
} as const;
