import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { CohortService } from '../application/cohort.service';
import {
  PublicCohortPartResponseDto,
  PublicCohortResponseDto,
} from './dto/public-cohort.response.dto';

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
    const cohort = await this.cohortService.findActiveCohortOrThrow();
    return ApiResponse.ok(PublicCohortResponseDto.from(cohort));
  }

  @ApiDoc({
    summary: '모집 파트 상세 조회',
    description: '특정 기수의 모집 분야(파트) 상세 정보 및 지원서 문항(Schema)을 조회합니다.',
    operationId: 'cohort_getPublicPartById',
  })
  @Get('parts/:id')
  async findPartById(@Param('id', ParseIntPipe) id: number) {
    const part = await this.cohortService.findPartByIdOrThrow({ id });
    return ApiResponse.ok(PublicCohortPartResponseDto.from(part));
  }
}
