import { Controller, HttpStatus } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AppException } from '../../common/exception/app.exception';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { CohortService } from '../application/cohort.service';
import { PublicCohortResponseDto } from './dto/public-cohort.response.dto';

@ApiTags('Cohort')
@Controller({ path: 'cohorts', version: '1' })
export class PublicCohortController {
  constructor(private readonly cohortService: CohortService) {}

  @ApiDoc({
    summary: '현재 활성 기수 조회',
    description: '현재 모집 중이거나 활동 중인 기수 정보와 홈페이지 CTA 버튼 상태를 반환합니다.',
    operationId: 'cohort_getPublicActive',
  })
  @Get('active')
  async findActiveCohort() {
    const cohort = await this.cohortService.findActiveCohort();
    if (!cohort) {
      throw new AppException('COHORT_NOT_FOUND', HttpStatus.NOT_FOUND);
    }

    return ApiResponse.ok(PublicCohortResponseDto.from(cohort));
  }
}
