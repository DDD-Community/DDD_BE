import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { EarlyNotificationResponseDto } from './dto/public-early-notification.response.dto';
import { GeneralEarlyNotificationResponseDto } from './dto/public-general-early-notification.response.dto';

/**
 * PublicEarlyNotificationController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const PublicEarlyNotificationSwagger = {
  subscribe: {
    success: {
      status: 200,
      description: '기수별 사전 알림 신청 결과를 반환합니다.',
      ...successResponseSchema(EarlyNotificationResponseDto),
    },
    notFound: CommonSwaggerResponses.notFound('기수를 찾을 수 없습니다.', 'COHORT_NOT_FOUND'),
  },
} as const;

export const PublicGeneralEarlyNotificationSwagger = {
  subscribeGeneral: {
    success: {
      status: 200,
      description: '사전 알림 대기열 신청 결과를 반환합니다.',
      ...successResponseSchema(GeneralEarlyNotificationResponseDto),
    },
  },
} as const;
