import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';
import type { DiscordTokenExchangeResult, DiscordUser } from '../domain/discord.type';

type DiscordTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

type DiscordUserResponse = {
  id: string;
  username: string;
  global_name?: string | null;
};

@Injectable()
export class DiscordOauthClient {
  private readonly logger = new Logger(DiscordOauthClient.name);
  private readonly provider: string;
  private readonly clientId: string | null;
  private readonly clientSecret: string | null;
  private readonly callbackUrl: string | null;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('DISCORD_PROVIDER') ?? 'console').toLowerCase();
    this.clientId = this.configService.get<string>('DISCORD_CLIENT_ID') ?? null;
    this.clientSecret = this.configService.get<string>('DISCORD_CLIENT_SECRET') ?? null;
    this.callbackUrl = this.configService.get<string>('DISCORD_CALLBACK_URL') ?? null;
  }

  buildAuthorizeUrl({ state }: { state: string }): string {
    if (this.provider !== 'discord' || !this.clientId || !this.callbackUrl) {
      const previewUrl = `https://example.com/discord-oauth-preview?state=${encodeURIComponent(state)}`;
      this.logger.log(`[Discord OAuth 미리보기] authorize url=${previewUrl}`);
      return previewUrl;
    }

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.callbackUrl,
      response_type: 'code',
      scope: 'identify guilds.join',
      state,
      prompt: 'consent',
    });

    return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
  }

  async exchangeCode({ code }: { code: string }): Promise<DiscordTokenExchangeResult> {
    if (this.provider !== 'discord') {
      this.logger.log(`[Discord OAuth 미리보기] exchange code=${code}`);
      return {
        accessToken: `preview-access-${Date.now()}`,
        refreshToken: `preview-refresh-${Date.now()}`,
        tokenType: 'Bearer',
        scope: 'identify guilds.join',
        expiresIn: 604800,
      };
    }

    if (!this.clientId || !this.clientSecret || !this.callbackUrl) {
      this.logger.error(
        'DISCORD_PROVIDER=discord 이지만 DISCORD_CLIENT_ID/SECRET/CALLBACK_URL가 누락되었습니다.',
      );
      throw new AppException('DISCORD_NOT_CONFIGURED', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.callbackUrl,
    });

    const response = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Discord token exchange failed: ${response.status} ${errorText}`);
      throw new AppException('DISCORD_OAUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const json = (await response.json()) as DiscordTokenResponse;
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      tokenType: json.token_type,
      scope: json.scope,
      expiresIn: json.expires_in,
    };
  }

  async fetchCurrentUser({ accessToken }: { accessToken: string }): Promise<DiscordUser> {
    if (this.provider !== 'discord') {
      const previewId = `preview-user-${Date.now()}`;
      this.logger.log(`[Discord OAuth 미리보기] fetch @me id=${previewId}`);
      return { id: previewId, username: 'preview-user', globalName: 'Preview User' };
    }

    const response = await fetch('https://discord.com/api/users/@me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(`Discord /users/@me failed: ${response.status} ${errorText}`);
      throw new AppException('DISCORD_OAUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const json = (await response.json()) as DiscordUserResponse;
    return {
      id: json.id,
      username: json.username,
      globalName: json.global_name ?? undefined,
    };
  }
}
