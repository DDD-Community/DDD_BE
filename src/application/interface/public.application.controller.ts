import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { ApplicationService } from '../application/application.service';
import {
  SaveApplicationDraftRequestDto,
  SubmitApplicationRequestDto,
} from './dto/application.request.dto';

@ApiTags('Application')
@Controller({ path: 'applications', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class PublicApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @ApiDoc({
    summary: '지원서 임시저장',
    description: '지원서를 임시저장합니다.',
    operationId: 'application_saveDraft',
    auth: true,
  })
  @Post('draft')
  @HttpCode(HttpStatus.OK)
  async saveDraft(@AuthUser() user: JwtUser, @Body() command: SaveApplicationDraftRequestDto) {
    await this.applicationService.saveDraft({ userId: user.id }, command);
    return ApiResponse.ok(null, '지원서 임시저장이 완료되었습니다.');
  }

  @ApiDoc({
    summary: '지원서 최종 제출',
    description: '지원서를 최종 제출합니다. 제출 후 자동 안내 이메일이 발송됩니다.',
    operationId: 'application_submit',
    auth: true,
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitApplication(@AuthUser() user: JwtUser, @Body() command: SubmitApplicationRequestDto) {
    await this.applicationService.submitForm({ userId: user.id, email: user.email }, command);
    return ApiResponse.ok(null, '지원서 제출이 완료되었습니다.');
  }
}
