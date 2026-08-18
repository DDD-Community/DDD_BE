import {
  CommonSwaggerResponses,
  errorResponseSchema,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { ApplicationVerificationResponseDto } from './dto/application.response.dto';

export const PublicApplicationVerificationSwagger = {
  request: {
    noContent: { status: 204, description: '인증번호 요청이 접수되었습니다.' },
    cooldown: {
      status: 429,
      description: '인증번호는 60초마다 요청할 수 있습니다.',
      ...errorResponseSchema('VERIFICATION_COOLDOWN', '인증번호는 60초마다 요청할 수 있습니다.'),
    },
  },
  confirm: {
    success: {
      status: 200,
      description: '이메일 인증이 완료되었습니다.',
      ...successResponseSchema(ApplicationVerificationResponseDto),
    },
    invalid: {
      status: 400,
      description: '인증번호가 올바르지 않습니다.',
      ...errorResponseSchema('VERIFICATION_CODE_INVALID', '인증번호가 올바르지 않습니다.'),
    },
    expired: {
      status: 400,
      description: '인증번호가 만료되었거나 더 이상 사용할 수 없습니다.',
      ...errorResponseSchema(
        'VERIFICATION_CODE_EXPIRED',
        '인증번호가 만료되었거나 더 이상 사용할 수 없습니다.',
      ),
    },
    unauthorized: CommonSwaggerResponses.unauthorized(),
  },
} as const;
