import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { MeResponseDto } from './dto/me.response.dto';

/**
 * UserController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const UserSwagger = {
  me: {
    success: {
      status: 200,
      description: '현재 로그인한 사용자의 식별 정보와 활성 권한을 반환합니다.',
      ...successResponseSchema(MeResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'access_token 쿠키가 없거나 만료되었습니다.',
    ),
  },
} as const;
