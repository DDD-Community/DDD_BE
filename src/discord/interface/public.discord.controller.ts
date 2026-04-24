import { Controller, Get, HttpStatus, Query, Redirect } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';

import { AppException } from '../../common/exception/app.exception';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { DiscordService } from '../application/discord.service';
import { DiscordAuthorizeResponseDto, DiscordLinkResponseDto } from './dto/discord.response.dto';

@ApiTags('Public - Discord')
@Controller({ path: 'discord', version: '1' })
export class PublicDiscordController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly configService: ConfigService,
  ) {}

  @ApiDoc({
    summary: 'Discord OAuth 동의 URL 조회',
    description: '합격자가 Discord 서버에 합류하기 위한 OAuth 동의 URL을 발급합니다.',
    operationId: 'discord_authorizeUrl',
  })
  @Get('oauth/authorize')
  authorize(@Query('applicationFormId') applicationFormId: string) {
    const parsed = Number(applicationFormId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    const authorizeUrl = this.discordService.buildAuthorizeUrl({ applicationFormId: parsed });
    return ApiResponse.ok(DiscordAuthorizeResponseDto.of({ authorizeUrl }));
  }

  @ApiDoc({
    summary: 'Discord OAuth 콜백',
    description: 'Discord가 돌려준 code를 처리하고 서버 초대 + Role 부여를 수행합니다.',
    operationId: 'discord_oauthCallback',
  })
  @Get('oauth/callback')
  @Redirect()
  async callback(@Query('code') code: string, @Query('state') state: string) {
    const applicationFormId = Number(state);
    if (!Number.isInteger(applicationFormId) || applicationFormId <= 0) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    if (!code) {
      throw new AppException('DISCORD_OAUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const link = await this.discordService.linkApplicant({
      applicationFormId,
      oauthCode: code,
    });

    const clientRedirectUrl = (this.configService.get<string>('CLIENT_REDIRECT_URL') ?? '').replace(
      /\/$/,
      '',
    );
    const redirectUrl = clientRedirectUrl
      ? `${clientRedirectUrl}/discord/link/success?applicationFormId=${link.applicationFormId}`
      : '/';
    return { url: redirectUrl, statusCode: HttpStatus.FOUND };
  }

  @ApiDoc({
    summary: 'Discord 연동 상태 조회',
    description: '지원서 ID로 Discord 연동 정보를 조회합니다.',
    operationId: 'discord_getLink',
  })
  @Get('link')
  async getLink(@Query('applicationFormId') applicationFormId: string) {
    const parsed = Number(applicationFormId);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new AppException('BAD_REQUEST', HttpStatus.BAD_REQUEST);
    }
    const link = await this.discordService.findByApplicationFormId({ applicationFormId: parsed });
    return ApiResponse.ok(DiscordLinkResponseDto.from(link));
  }
}
