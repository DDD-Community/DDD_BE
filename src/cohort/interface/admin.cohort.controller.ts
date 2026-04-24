import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { CohortService } from '../application/cohort.service';
import {
  CreateCohortRequestDto,
  UpdateCohortPartsRequestDto,
  UpdateCohortRequestDto,
} from './dto/admin-cohort.request.dto';
import { CohortAdminResponseDto } from './dto/admin-cohort.response.dto';

@ApiTags('Admin - Cohort')
@Controller({ path: 'admin/cohorts', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminCohortController {
  constructor(private readonly cohortService: CohortService) {}

  @ApiDoc({
    summary: '새 기수 생성',
    description: '새로운 기수를 생성합니다. 모집 파트 설정도 함께 포함할 수 있습니다.',
    operationId: 'cohort_createAdmin',
    auth: true,
  })
  @Post()
  async createCohort(@Body() body: CreateCohortRequestDto) {
    const cohort = await this.cohortService.createCohort({
      cohort: {
        ...body,
        parts: body.parts?.map(({ name, isOpen, formSchema }) => ({
          partName: name,
          isOpen,
          applicationSchema: formSchema,
        })),
      },
    });
    return ApiResponse.ok(CohortAdminResponseDto.from(cohort));
  }

  @ApiDoc({
    summary: '기수 전체 목록 조회',
    description: '모든 기수와 각 기수별 파트 설정 정보를 조회합니다.',
    operationId: 'cohort_getAdminList',
    auth: true,
  })
  @Get()
  async findAllCohorts() {
    const cohorts = await this.cohortService.findAllCohorts();
    return ApiResponse.ok(cohorts.map((cohort) => CohortAdminResponseDto.from(cohort)));
  }

  @ApiDoc({
    summary: '기수 단건 조회',
    description: '특정 기수의 상세 정보를 조회합니다.',
    operationId: 'cohort_getAdminById',
    auth: true,
  })
  @Get(':id')
  async findCohortById(@Param('id', ParseIntPipe) id: number) {
    const cohort = await this.cohortService.findCohortById({ id });
    return ApiResponse.ok(CohortAdminResponseDto.from(cohort));
  }

  @ApiDoc({
    summary: '기수 정보 및 상태 수정',
    description: '기수의 명칭, 일정, 상태 등을 수동으로 수정합니다.',
    operationId: 'cohort_updateAdminById',
    auth: true,
  })
  @Patch(':id')
  async updateCohort(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCohortRequestDto) {
    await this.cohortService.updateCohort({ id, data: body });
    return ApiResponse.ok(null, '기수 정보가 수정되었습니다.');
  }

  @ApiDoc({
    summary: '기수별 파트 모집 설정',
    description:
      '기수별로 모집할 파트와 각 파트별 지원서 스키마(JSON)를 설정합니다. 전체 교체 방식으로 동작합니다.',
    operationId: 'cohort_updateAdminPartsById',
    auth: true,
  })
  @Put(':id/parts')
  async updateCohortParts(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateCohortPartsRequestDto,
  ) {
    await this.cohortService.updateCohortParts({
      id,
      parts: body.parts.map(({ name, isOpen, formSchema }) => ({
        partName: name,
        isOpen,
        applicationSchema: formSchema,
      })),
    });
    return ApiResponse.ok(null, '파트 설정이 저장되었습니다.');
  }

  @ApiDoc({
    summary: '기수 삭제',
    description: '기수를 소프트 삭제합니다.',
    operationId: 'cohort_deleteAdminById',
    auth: true,
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCohort(@Param('id', ParseIntPipe) id: number) {
    await this.cohortService.deleteCohort({ id });
  }
}
