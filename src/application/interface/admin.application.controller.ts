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
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { ApplicationService } from '../application/application.service';
import {
  ApplicationAdminFilterDto,
  UpdateApplicationStatusRequestDto,
} from './dto/application.request.dto';
import { AdminApplicationFormResponseDto } from './dto/application.response.dto';

// TODO: Admin Role Guard 적용 필요
@ApiTags('Admin - Application')
@Controller({ path: 'admin/applications', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class AdminApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @ApiDoc({
    summary: '어드민 지원서 목록 조회',
    description: '지원자 목록을 조회합니다.',
    operationId: 'application_getAdminList',
    auth: true,
  })
  @Get()
  async getApplications(@Query() filter: ApplicationAdminFilterDto) {
    const forms = await this.applicationService.findForms(filter);
    return ApiResponse.ok(forms.map((form) => AdminApplicationFormResponseDto.from(form)));
  }

  @ApiDoc({
    summary: '어드민 지원서 단건 상세 조회',
    description: '특정 지원서의 상세 원문과 정보를 모두 가져옵니다.',
    operationId: 'application_getAdminById',
    auth: true,
  })
  @Get(':id')
  async getApplicationById(@Param('id', ParseIntPipe) id: number) {
    const form = await this.applicationService.findFormById(id);
    return ApiResponse.ok(form ? AdminApplicationFormResponseDto.from(form) : null);
  }

  @ApiDoc({
    summary: '어드민 지원서 상태 업데이트',
    description:
      '지원서의 상태(합격/불합격 등)를 수동으로 변경합니다. 변경 시 알맞은 이메일 트리거가 동작합니다.',
    operationId: 'application_patchAdminStatusById',
    auth: true,
  })
  @Patch(':id/status')
  async updateApplicationStatus(
    @Param('id', ParseIntPipe) id: number,
    @AuthUser() user: JwtUser,
    @Body() command: UpdateApplicationStatusRequestDto,
  ) {
    await this.applicationService.updateStatus(id, user.id, command);
    return ApiResponse.ok(null, '지원서 상태가 성공적으로 변경되었습니다.');
  }
}
