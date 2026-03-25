import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { GoogleAuthCallbackResponseDto, GoogleRefreshResponseDto } from './dto/google-auth.dto';

/**
 * GoogleAuthController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const GoogleAuthSwagger = {
  googleCallback: {
    success: {
      status: 200,
      description:
        '[개발 전용] OAuth 콜백 성공. 프로덕션에서는 CLIENT_REDIRECT_URL로 리다이렉트됩니다.',
      ...successResponseSchema(GoogleAuthCallbackResponseDto),
    },
  },

  refresh: {
    success: {
      status: 200,
      description:
        'Access Token 재발급 성공. access_token · refresh_token 쿠키가 자동으로 갱신됩니다.',
      ...successResponseSchema(GoogleRefreshResponseDto),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(
      'refresh_token 쿠키가 없거나 만료되었습니다.',
    ),
  },

  logout: {
    noContent: {
      status: 204,
      description: '로그아웃 성공. access_token · refresh_token 쿠키가 삭제됩니다.',
    },
    unauthorized: CommonSwaggerResponses.unauthorized('access_token 쿠키가 없거나 만료되었습니다.'),
  },

  withdrawal: {
    noContent: {
      status: 204,
      description: '회원 탈퇴 성공. 소프트 삭제 처리되며, Google 토큰도 revoke됩니다.',
    },
    unauthorized: CommonSwaggerResponses.unauthorized('access_token 쿠키가 없거나 만료되었습니다.'),
    notFound: CommonSwaggerResponses.notFound('사용자를 찾을 수 없습니다.', 'USER_NOT_FOUND'),
  },
} as const;
