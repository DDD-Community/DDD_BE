import {
  CommonSwaggerResponses,
  successListResponseSchema,
  successNullResponseSchema,
  successResponseSchema,
} from '../../common/swagger/response-schema';
import { AdminProjectListResponseDto, ProjectDetailResponseDto } from './dto/project.response.dto';

const unauthorized = CommonSwaggerResponses.unauthorized(
  'access_token 쿠키가 없거나 만료되었습니다.',
);
const notFound = CommonSwaggerResponses.notFound(
  '프로젝트를 찾을 수 없습니다.',
  'PROJECT_NOT_FOUND',
);

/**
 * AdminProjectController Swagger 응답 스키마 정의
 * 컨트롤러 가독성 보호를 위해 별도 파일로 분리
 */
export const AdminProjectSwagger = {
  createProject: {
    success: {
      status: 201,
      description: '프로젝트 생성 성공',
      ...successResponseSchema(ProjectDetailResponseDto),
    },
    unauthorized,
  },

  findAllProjects: {
    success: {
      status: 200,
      description: '프로젝트 목록 조회 성공. 참여자와 PDF URL 을 포함합니다.',
      ...successListResponseSchema(AdminProjectListResponseDto),
    },
    unauthorized,
  },

  findProjectById: {
    success: {
      status: 200,
      description: '프로젝트 상세 조회 성공. 참여자와 PDF URL 을 포함합니다.',
      ...successResponseSchema(ProjectDetailResponseDto),
    },
    unauthorized,
    notFound,
  },

  updateProject: {
    success: {
      status: 200,
      description: '프로젝트가 수정되었습니다.',
      ...successNullResponseSchema('프로젝트가 수정되었습니다.'),
    },
    unauthorized,
    notFound,
  },

  updateProjectMembers: {
    success: {
      status: 200,
      description: '프로젝트 참여자가 수정되었습니다.',
      ...successNullResponseSchema('프로젝트 참여자가 수정되었습니다.'),
    },
    unauthorized,
    notFound,
  },

  deleteProject: {
    noContent: {
      status: 204,
      description: '프로젝트 삭제 성공',
    },
    unauthorized,
    notFound,
  },
} as const;
