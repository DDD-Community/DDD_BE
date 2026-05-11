import {
  CommonSwaggerResponses,
  successListResponseSchema,
  successNullResponseSchema,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import {
  InterviewReservationResponseDto,
  InterviewSlotResponseDto,
} from './dto/interview.response.dto';

/**
 * AdminInterviewController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const AdminInterviewSwagger = {
  createSlot: {
    success: {
      status: 201,
      description: '면접 슬롯 생성 성공',
      ...successResponseSchema(InterviewSlotResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
  },

  listSlots: {
    success: {
      status: 200,
      description: '면접 슬롯 목록 조회 성공',
      ...successListResponseSchema(InterviewSlotResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
  },

  getSlot: {
    success: {
      status: 200,
      description: '면접 슬롯 상세 조회 성공',
      ...successResponseSchema(InterviewSlotResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
    notFound: CommonSwaggerResponses.notFound(
      '면접 슬롯을 찾을 수 없습니다.',
      'INTERVIEW_SLOT_NOT_FOUND',
    ),
  },

  updateSlot: {
    success: {
      status: 200,
      description: '면접 슬롯이 수정되었습니다.',
      ...successNullResponseSchema('면접 슬롯이 수정되었습니다.'),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
    notFound: CommonSwaggerResponses.notFound(
      '면접 슬롯을 찾을 수 없습니다.',
      'INTERVIEW_SLOT_NOT_FOUND',
    ),
  },

  deleteSlot: {
    noContent: {
      status: 204,
      description: '면접 슬롯 삭제 성공',
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
    notFound: CommonSwaggerResponses.notFound(
      '면접 슬롯을 찾을 수 없습니다.',
      'INTERVIEW_SLOT_NOT_FOUND',
    ),
  },

  createReservation: {
    success: {
      status: 201,
      description: '면접 예약 생성 성공',
      ...successResponseSchema(InterviewReservationResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
    notFound: CommonSwaggerResponses.notFoundOneOf(
      '슬롯 또는 지원서를 찾을 수 없습니다.',
      [
        {
          code: 'INTERVIEW_SLOT_NOT_FOUND',
          message: '면접 슬롯을 찾을 수 없습니다.',
        },
        {
          code: 'APPLICATION_NOT_FOUND',
          message: '해당 지원서를 찾을 수 없습니다.',
        },
      ],
    ),
  },

  cancelReservation: {
    noContent: {
      status: 204,
      description: '면접 예약 취소 성공',
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
    notFound: CommonSwaggerResponses.notFound(
      '면접 예약을 찾을 수 없습니다.',
      'INTERVIEW_RESERVATION_NOT_FOUND',
    ),
  },
} as const;
