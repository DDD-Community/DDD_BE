import { successResponseSchema } from '../../common/swagger/response-schema';
import { CohortAdminResponseDto } from './dto/admin-cohort.response.dto';

const savedCohortResponse = {
  status: 200,
  description: '기수 저장 및 출석 일정 동기화 결과',
  ...successResponseSchema(CohortAdminResponseDto),
};

export const AdminCohortSwagger = {
  createCohort: { responses: [savedCohortResponse] },
  updateCohort: { responses: [savedCohortResponse] },
};
