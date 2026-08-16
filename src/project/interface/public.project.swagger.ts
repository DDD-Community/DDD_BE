import {
  CommonSwaggerResponses,
  successCursorListResponseSchema,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { ProjectDetailResponseDto, ProjectListResponseDto } from './dto/project.response.dto';

/**
 * PublicProjectController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const PublicProjectSwagger = {
  findAllProjects: {
    success: {
      status: 200,
      description: '프로젝트 목록 조회 성공. meta 에 커서 정보를 포함합니다.',
      ...successCursorListResponseSchema(ProjectListResponseDto),
    },
  },

  findProjectById: {
    success: {
      status: 200,
      description: '프로젝트 상세 조회 성공. 참여자와 PDF URL 을 포함합니다.',
      ...successResponseSchema(ProjectDetailResponseDto),
    },
    notFound: CommonSwaggerResponses.notFound('프로젝트를 찾을 수 없습니다.', 'PROJECT_NOT_FOUND'),
  },
} as const;
