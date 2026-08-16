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
  active: {
    success: {
      status: 200,
      description: '현재 모집 중이거나 활동 중인 기수 정보와 홈페이지 CTA 버튼 상태를 반환합니다.',
      ...successResponseSchema(PublicCohortResponseDto),
    },
    notFound: CommonSwaggerResponses.notFound('활성 기수가 없습니다.', 'COHORT_NOT_FOUND'),
  },
  partById: {
    success: {
      status: 200,
      description: '특정 기수의 모집 파트 상세 정보와 지원서 문항(Schema)을 반환합니다.',
      ...successResponseSchema(PublicCohortPartResponseDto),
    },
    notFound: CommonSwaggerResponses.notFound(
      '모집 중인 파트를 찾을 수 없습니다.',
      'COHORT_PART_NOT_FOUND',
    ),
  },
} as const;
