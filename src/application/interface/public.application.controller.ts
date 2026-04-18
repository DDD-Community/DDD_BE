import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
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
  SaveApplicationDraftRequestDto,
  SubmitApplicationRequestDto,
} from './dto/application.request.dto';
import { PublicApplicationDraftResponseDto } from './dto/application.response.dto';

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
    const saveDraftCommand = {
      cohortPartId: command.cohortPartId,
      answers: command.answers,
    };
    await this.applicationService.saveDraft({ userId: user.id }, saveDraftCommand);
    return ApiResponse.ok(null, '지원서 임시저장이 완료되었습니다.');
  }

  @ApiDoc({
    summary: '지원서 임시저장 조회',
    description: '파트별 임시저장 지원서를 조회합니다.',
    operationId: 'application_getDraftByPart',
    auth: true,
  })
  @Get('draft/:cohortPartId')
  async findDraftByPart(
    @AuthUser() user: JwtUser,
    @Param('cohortPartId', ParseIntPipe) cohortPartId: number,
  ) {
    const draft = await this.applicationService.findDraftByPart({ userId: user.id, cohortPartId });
    return ApiResponse.ok(PublicApplicationDraftResponseDto.from(draft));
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
    const submitFormCommand = {
      cohortPartId: command.cohortPartId,
      applicantName: command.applicantName,
      applicantPhone: command.applicantPhone,
      applicantBirthDate: command.applicantBirthDate,
      applicantRegion: command.applicantRegion,
      answers: command.answers,
      privacyAgreed: command.privacyAgreed,
    };
    await this.applicationService.submitForm(
      { userId: user.id, email: user.email },
      submitFormCommand,
    );
    return ApiResponse.ok(null, '지원서 제출이 완료되었습니다.');
  }
}
