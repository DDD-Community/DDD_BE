import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UPLOAD_CATEGORY_CONFIG, UploadCategory } from '../../storage/domain/storage.type';
import { SignedUrlResponseDto } from '../../storage/interface/dto/storage.response.dto';
import { ApplicationService } from '../usecase/application.service';
import { ApplicationAttachmentService } from '../usecase/application-attachment.service';
import {
  AttachmentPathQueryDto,
  SaveApplicationDraftRequestDto,
  SubmitApplicationRequestDto,
} from './dto/application.request.dto';
import {
  ApplicationAttachmentResponseDto,
  PublicApplicationDraftResponseDto,
} from './dto/application.response.dto';

@ApiTags('Application')
@Controller({ path: 'applications', version: '1' })
@UseGuards(AuthGuard('jwt'))
export class PublicApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly applicationAttachmentService: ApplicationAttachmentService,
  ) {}

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
    summary: '지원서 첨부파일 업로드',
    description:
      'PDF 포트폴리오 등 지원서 첨부파일을 업로드하고 경로를 반환합니다. 반환된 path 를 answers 에 담아 제출하세요.',
    operationId: 'application_uploadAttachment',
    auth: true,
  })
  @ApiConsumes('multipart/form-data')
  @Post('attachments')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: UPLOAD_CATEGORY_CONFIG[UploadCategory.APPLICATION_ATTACHMENT].maxSizeBytes,
      },
    }),
  )
  async uploadAttachment(@AuthUser() user: JwtUser, @UploadedFile() file: Express.Multer.File) {
    const filePayload = file
      ? {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        }
      : null;

    const attachment = await this.applicationAttachmentService.upload({
      userId: user.id,
      file: filePayload,
    });

    return ApiResponse.ok(ApplicationAttachmentResponseDto.from(attachment));
  }

  @ApiDoc({
    summary: '지원서 첨부파일 열람 URL 발급',
    description:
      '본인이 업로드한 첨부파일의 만료형 서명 URL을 발급합니다. 타인의 첨부 경로는 거부됩니다.',
    operationId: 'application_createAttachmentUrl',
    auth: true,
  })
  @Get('attachments/signed-url')
  async createAttachmentUrl(@AuthUser() user: JwtUser, @Query() query: AttachmentPathQueryDto) {
    const result = await this.applicationAttachmentService.createReadUrl({
      userId: user.id,
      path: query.path,
    });

    return ApiResponse.ok(SignedUrlResponseDto.from(result));
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
