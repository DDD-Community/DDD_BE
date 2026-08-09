import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { SendBulkEarlyNotificationResponseDto } from './dto/admin-early-notification.response.dto';

/**
 * AdminEarlyNotificationController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const AdminEarlyNotificationSwagger = {
  sendBulk: {
    success: {
      status: 200,
      description: '발송이 완료되었습니다. 부분 실패 여부는 failed 값으로 판단합니다.',
      ...successResponseSchema(SendBulkEarlyNotificationResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized('access_token 쿠키가 없거나 만료되었습니다.'),
  },
};
