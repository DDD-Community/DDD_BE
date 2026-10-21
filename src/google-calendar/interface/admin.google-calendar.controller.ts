import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiExtraModels, ApiTags } from '@nestjs/swagger';
import type { CookieOptions, Response } from 'express';

import type { JwtUser } from '../../auth/application/auth.type';
import { AuthUser } from '../../common/decorator/auth-user.decorator';
import { Cookie } from '../../common/decorator/cookie.decorator';
import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { GoogleCalendarConnectionService } from '../application/google-calendar-connection.service';
import { describeUnexpectedError } from '../application/google-calendar-error-log';
import { AdminGoogleCalendarSwagger } from './admin.google-calendar.swagger';
import {
  GoogleCalendarCallbackQueryDto,
  TestMeetingEventParamDto,
  TestMeetingRequestDto,
} from './dto/google-calendar.request.dto';
import {
  GoogleCalendarAuthorizationResponseDto,
  GoogleCalendarStatusResponseDto,
  TestMeetingResponseDto,
} from './dto/google-calendar.response.dto';
import { GoogleCalendarCallbackRedirectFilter } from './google-calendar-callback-redirect.filter';

const NONCE_COOKIE = 'gcal_connect_nonce';
const NONCE_COOKIE_PATH = '/api/v1/admin/google-calendar';
const NONCE_MAX_AGE_MS = 10 * 60 * 1000;

@ApiTags('Admin - Google Calendar')
@ApiExtraModels(
  GoogleCalendarAuthorizationResponseDto,
  GoogleCalendarStatusResponseDto,
  TestMeetingResponseDto,
)
@Controller({ path: 'admin/google-calendar', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자, UserRole.면접관)
export class AdminGoogleCalendarController {
  private readonly logger = new Logger(AdminGoogleCalendarController.name);
  private readonly cookieOptions: CookieOptions;
  private readonly clientRedirectUrl: string;

  constructor(
    private readonly service: GoogleCalendarConnectionService,
    configService: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: configService.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax',
      path: NONCE_COOKIE_PATH,
    };
    this.clientRedirectUrl = configService.getOrThrow<string>('CLIENT_REDIRECT_URL');
  }

  @ApiDoc({
    summary: 'Google Calendar 연동 시작',
    operationId: 'googleCalendar_connect',
    auth: true,
    responses: [
      AdminGoogleCalendarSwagger.connect.success,
      AdminGoogleCalendarSwagger.connect.unauthorized,
    ],
  })
  @Post('connect')
  @HttpCode(HttpStatus.OK)
  async connect(@AuthUser() user: JwtUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.service.connect({ userId: user.id });
    response.cookie(NONCE_COOKIE, result.nonce, {
      ...this.cookieOptions,
      maxAge: NONCE_MAX_AGE_MS,
    });
    return ApiResponse.ok({ authorizationUrl: result.authorizationUrl });
  }

  @ApiDoc({
    summary: 'Google Calendar OAuth 콜백',
    operationId: 'googleCalendar_callback',
    auth: true,
    responses: [AdminGoogleCalendarSwagger.callback.redirect],
  })
  @Get('callback')
  @UseFilters(GoogleCalendarCallbackRedirectFilter)
  async callback(
    @AuthUser() user: JwtUser,
    @Query() query: GoogleCalendarCallbackQueryDto,
    @Cookie(NONCE_COOKIE) nonce: string | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    let reason: string | null = null;
    try {
      const result = await this.service.callback({
        userId: user.id,
        code: query.code,
        state: query.state,
        error: query.error,
        nonce,
      });
      if (!result.connected) {
        reason = result.reason;
      }
    } catch (error) {
      // 저장 등 예상 밖 예외. 메시지에는 무엇이 섞일지 모르므로 형식이 정해진 식별자만 남긴다.
      this.logger.error(
        `Google Calendar 연결 콜백 처리 중 예외: userId=${user.id}, ${describeUnexpectedError(error)}`,
      );
      reason = 'internal_error';
    } finally {
      // 콜백 성공 여부와 무관하게 nonce 를 지워 같은 state 의 재사용을 막는다.
      response.clearCookie(NONCE_COOKIE, this.cookieOptions);
    }
    const redirectUrl = new URL(this.clientRedirectUrl);
    redirectUrl.searchParams.set('calendar', reason ? 'error' : 'connected');
    if (reason) {
      redirectUrl.searchParams.set('reason', reason);
    }
    response.redirect(HttpStatus.FOUND, redirectUrl.toString());
  }

  @ApiDoc({
    summary: 'Google Calendar 연동 상태',
    operationId: 'googleCalendar_status',
    auth: true,
    responses: [
      AdminGoogleCalendarSwagger.status.success,
      AdminGoogleCalendarSwagger.status.unauthorized,
    ],
  })
  @Get('status')
  async status(@AuthUser() user: JwtUser) {
    const status = await this.service.status({ userId: user.id });
    return ApiResponse.ok(status);
  }

  @ApiDoc({
    summary: 'Google Calendar 연동 해제',
    operationId: 'googleCalendar_disconnect',
    auth: true,
    responses: [
      AdminGoogleCalendarSwagger.disconnect.noContent,
      AdminGoogleCalendarSwagger.disconnect.unauthorized,
    ],
  })
  @Delete('connection')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(@AuthUser() user: JwtUser): Promise<void> {
    await this.service.disconnect({ userId: user.id });
  }

  @ApiDoc({
    summary: '테스트 Meet 생성',
    operationId: 'googleCalendar_createTestMeeting',
    auth: true,
    responses: [
      AdminGoogleCalendarSwagger.testMeeting.success,
      AdminGoogleCalendarSwagger.testMeeting.unauthorized,
    ],
  })
  @Post('test-meeting')
  async createTestMeeting(@AuthUser() user: JwtUser, @Body() body: TestMeetingRequestDto) {
    const meeting = await this.service.createTestMeeting({
      userId: user.id,
      attendeeEmails: body.attendeeEmails,
    });
    return ApiResponse.ok(meeting);
  }

  @ApiDoc({
    summary: '테스트 Meet 삭제',
    operationId: 'googleCalendar_deleteTestMeeting',
    auth: true,
    responses: [
      AdminGoogleCalendarSwagger.deleteTestMeeting.noContent,
      AdminGoogleCalendarSwagger.deleteTestMeeting.unauthorized,
    ],
  })
  @Delete('test-meeting/:eventId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTestMeeting(
    @AuthUser() user: JwtUser,
    @Param() params: TestMeetingEventParamDto,
  ): Promise<void> {
    await this.service.deleteTestMeeting({ userId: user.id, eventId: params.eventId });
  }
}
