import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';

import { AuthService } from '../../auth/application/auth.service';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { ApplicationVerificationService } from '../usecase/application-verification.service';
import {
  ConfirmApplicationVerificationRequestDto,
  RequestApplicationVerificationRequestDto,
} from './dto/application.request.dto';
import { ApplicationVerificationResponseDto } from './dto/application.response.dto';
import { PublicApplicationVerificationSwagger } from './public.application-verification.swagger';

const APPLICANT_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@ApiTags('지원자 이메일 인증')
@ApiExtraModels(ApplicationVerificationResponseDto)
@Controller({ path: 'applications/verify', version: '1' })
@UseGuards(ThrottlerGuard)
export class PublicApplicationVerificationController {
  private readonly cookieOptions: CookieOptions;

  constructor(
    private readonly verificationService: ApplicationVerificationService,
    private readonly authService: AuthService,
    configService: ConfigService,
  ) {
    const isProduction = configService.get<string>('NODE_ENV') === 'production';
    this.cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: APPLICANT_SESSION_MAX_AGE_MS,
    };
  }

  @ApiDoc({
    summary: '지원자 이메일 인증번호 요청',
    description: '입력한 이메일로 인증번호를 발송합니다.',
    operationId: 'application_requestVerificationCode',
    responses: [
      PublicApplicationVerificationSwagger.request.noContent,
      PublicApplicationVerificationSwagger.request.cooldown,
    ],
  })
  @Post('request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 10 * 60 * 1000 } })
  async requestCode(@Body() command: RequestApplicationVerificationRequestDto): Promise<void> {
    await this.verificationService.requestCode({ email: command.email });
  }

  @ApiDoc({
    summary: '지원자 이메일 인증번호 확인',
    description: '인증번호를 확인하고 지원자 세션 cookie를 발급합니다.',
    operationId: 'application_confirmVerificationCode',
    responses: [
      PublicApplicationVerificationSwagger.confirm.success,
      PublicApplicationVerificationSwagger.confirm.invalid,
      PublicApplicationVerificationSwagger.confirm.expired,
    ],
  })
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 10 * 60 * 1000 } })
  async confirmCode(
    @Body() command: ConfirmApplicationVerificationRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.verificationService.confirmCode({
      email: command.email,
      code: command.code,
    });
    const accessToken = this.authService.signApplicantToken({
      id: result.userId,
      email: result.email,
    });
    response.cookie('access_token', accessToken, this.cookieOptions);
    return ApiResponse.ok(
      ApplicationVerificationResponseDto.from(result.email),
      '이메일 인증이 완료되었습니다.',
    );
  }
}
