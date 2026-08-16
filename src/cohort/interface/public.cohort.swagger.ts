import {
  CommonSwaggerResponses,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import {
  PublicCohortPartResponseDto,
  PublicCohortResponseDto,
} from './dto/public-cohort.response.dto';

/**
 * PublicCohortController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const PublicCohortSwagger = {
  getActive: {
    success: {
      status: 200,
      description: '현재 활성 기수와 홈페이지 CTA 상태를 반환합니다.',
      ...successResponseSchema(PublicCohortResponseDto),
    },
  },
  getPartById: {
    success: {
      status: 200,
      description: '모집 중인 파트 상세 정보를 반환합니다.',
      ...successResponseSchema(PublicCohortPartResponseDto),
    },
    notFound: CommonSwaggerResponses.notFound(
      '모집 중인 파트를 찾을 수 없습니다.',
      'COHORT_PART_NOT_FOUND',
    ),
  },
} as const;
