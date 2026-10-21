import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { ApplicationService } from '../usecase/application.service';
import { ApplicationQueryService } from '../usecase/application-query.service';
import { ApplicationTestEmailService } from '../usecase/application-test-email.service';
import {
  ApplicationAdminFilterDto,
  SendTestEmailRequestDto,
  UpdateApplicationStatusRequestDto,
} from './dto/application.request.dto';
import { AdminApplicationFormResponseDto } from './dto/application.response.dto';

@ApiTags('Admin - Application')
@Controller({ path: 'admin/applications', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자, UserRole.면접관)
export class AdminApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly applicationQueryService: ApplicationQueryService,
    private readonly applicationTestEmailService: ApplicationTestEmailService,
  ) {}

  @ApiDoc({
    summary: '지원자 안내 메일 테스트 발송',
    description:
      '기수의 현재 설정값으로 지원자 안내 메일을 실제 양식 그대로 만들어 로그인한 운영진 본인 이메일로 보냅니다. 지원서 상태는 바뀌지 않습니다.',
    operationId: 'application_sendTestEmail',
    auth: true,
  })
  // 면접관은 메일 양식을 다루지 않는다. 기수 설정을 고치는 권한과 맞춘다.
  @Roles(UserRole.계정관리, UserRole.운영자)
  @Post('test-emails')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendTestEmail(@AuthUser() user: JwtUser, @Body() body: SendTestEmailRequestDto) {
    await this.applicationTestEmailService.sendTestEmail({
      cohortId: body.cohortId,
      type: body.type,
      to: user.email,
    });
  }

  @ApiDoc({
    summary: '어드민 지원서 목록 조회',
    description: '지원자 목록을 조회합니다.',
    operationId: 'application_getAdminList',
    auth: true,
  })
  @Get()
  async getApplications(@AuthUser() user: JwtUser, @Query() filter: ApplicationAdminFilterDto) {
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
  async getApplicationById(@AuthUser() user: JwtUser, @Param('id', ParseIntPipe) id: number) {
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
  @Roles(UserRole.계정관리, UserRole.운영자)
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
