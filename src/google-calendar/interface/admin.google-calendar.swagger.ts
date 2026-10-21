import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import {
  GoogleCalendarAuthorizationResponseDto,
  GoogleCalendarStatusResponseDto,
  TestMeetingResponseDto,
} from './dto/google-calendar.response.dto';

const unauthorized = CommonSwaggerResponses.unauthorized(
  'access_token 쿠키가 없거나 만료되었습니다.',
);

export const AdminGoogleCalendarSwagger = {
  connect: {
    success: {
      status: 200,
      description: '연동 주소 생성',
      ...successResponseSchema(GoogleCalendarAuthorizationResponseDto),
    },
    unauthorized,
  },
  callback: {
    redirect: { status: 302, description: '클라이언트로 연동 결과 리다이렉트' },
  },
  status: {
    success: {
      status: 200,
      description: '연동 상태 조회',
      ...successResponseSchema(GoogleCalendarStatusResponseDto),
    },
    unauthorized,
  },
  disconnect: { noContent: { status: 204, description: '연동 해제' }, unauthorized },
  testMeeting: {
    success: {
      status: 201,
      description: '테스트 Meet 생성',
      ...successResponseSchema(TestMeetingResponseDto),
    },
    unauthorized,
  },
  deleteTestMeeting: { noContent: { status: 204, description: '테스트 Meet 삭제' }, unauthorized },
} as const;
