import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { ApplicationQueryService } from '../application/application-query.service';
import { ApplicationService } from '../application/application.service';
import {
  ApplicationAdminFilterDto,
  UpdateApplicationStatusRequestDto,
} from './dto/application.request.dto';
import { AdminApplicationFormResponseDto } from './dto/application.response.dto';

@ApiTags('Admin - Application')
@Controller({ path: 'admin/applications', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.면접관)
export class AdminApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly applicationQueryService: ApplicationQueryService,
  ) {}

  @ApiDoc({
    summary: '어드민 지원서 목록 조회',
    description: '지원자 목록을 조회합니다.',
    operationId: 'application_getAdminList',
    auth: true,
  })
  @Get()
  async getApplications(
    @AuthUser() user: JwtUser,
    @Query() filter: ApplicationAdminFilterDto,
  ) {
    const applicationAdminFilter = {
      cohortId: filter.cohortId,
      cohortPartId: filter.cohortPartId,
      status: filter.status,
    };
    const forms = await this.applicationQueryService.findFormsWithFilter(applicationAdminFilter);
    return ApiResponse.ok(
      forms.map((form) => AdminApplicationFormResponseDto.from(form, user.roles)),
    );
  }

  @ApiDoc({
    summary: '어드민 지원서 단건 상세 조회',
    description: '특정 지원서의 상세 원문과 정보를 모두 가져옵니다.',
    operationId: 'application_getAdminById',
    auth: true,
  })
  @Get(':id')
  async getApplicationById(
    @AuthUser() user: JwtUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const form = await this.applicationService.findFormById({ id });
    return ApiResponse.ok(AdminApplicationFormResponseDto.from(form, user.roles));
  }

  @ApiDoc({
    summary: '어드민 지원서 상태 업데이트',
    description:
      '지원서의 상태(합격/불합격 등)를 수동으로 변경합니다. 변경 시 알맞은 이메일 트리거가 동작합니다.',
    operationId: 'application_patchAdminStatusById',
    auth: true,
  })
  @Roles(UserRole.계정관리)
  @Patch(':id/status')
  async updateApplicationStatus(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: JwtUser,
    @Body() command: UpdateApplicationStatusRequestDto,
  ) {
    const updateStatusCommand = {
      status: command.status,
    };
    await this.applicationService.updateStatus(
      { formId: id, adminId: user.id },
      updateStatusCommand,
    );
    return ApiResponse.ok(null, '지원서 상태가 성공적으로 변경되었습니다.');
  }
}
