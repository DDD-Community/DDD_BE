import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AppException } from '../../common/exception/app.exception';

type AddGuildMemberPayload = {
  discordUserId: string;
  accessToken: string;
  roleIds: string[];
};

@Injectable()
export class DiscordBotClient {
  private readonly logger = new Logger(DiscordBotClient.name);
  private readonly provider: string;
  private readonly botToken: string | null;
  private readonly guildId: string | null;

  constructor(private readonly configService: ConfigService) {
    this.provider = (this.configService.get<string>('DISCORD_PROVIDER') ?? 'console').toLowerCase();
    this.botToken = this.configService.get<string>('DISCORD_BOT_TOKEN') ?? null;
    this.guildId = this.configService.get<string>('DISCORD_GUILD_ID') ?? null;
  }

  async addGuildMember({
    discordUserId,
    accessToken,
    roleIds,
  }: AddGuildMemberPayload): Promise<void> {
    if (this.provider !== 'discord') {
      this.logger.log(
        `[Discord Bot 미리보기] add guild member userId=${discordUserId}, roles=[${roleIds.join(',')}]`,
      );
      return;
    }

    if (!this.botToken || !this.guildId) {
      this.logger.error(
        'DISCORD_PROVIDER=discord 이지만 DISCORD_BOT_TOKEN 또는 DISCORD_GUILD_ID가 누락되었습니다.',
      );
      throw new AppException('DISCORD_NOT_CONFIGURED', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const response = await fetch(
      `https://discord.com/api/guilds/${this.guildId}/members/${discordUserId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          roles: roleIds,
        }),
      },
    );

    // Discord returns 201 (Created) or 204 (No Content: already a member). Both are success.
    if (response.status === 201 || response.status === 204) {
      return;
    }

    const errorText = await response.text();
    this.logger.error(
      `Discord add guild member failed: status=${response.status}, body=${errorText}`,
    );
    throw new AppException('DISCORD_GUILD_ADD_FAILED', HttpStatus.BAD_GATEWAY);
  }

  async assignRole({
    discordUserId,
    roleId,
  }: {
    discordUserId: string;
    roleId: string;
  }): Promise<void> {
    if (this.provider !== 'discord') {
      this.logger.log(
        `[Discord Bot 미리보기] assign role userId=${discordUserId}, roleId=${roleId}`,
      );
      return;
    }

    if (!this.botToken || !this.guildId) {
      this.logger.error(
        'DISCORD_PROVIDER=discord 이지만 DISCORD_BOT_TOKEN 또는 DISCORD_GUILD_ID가 누락되었습니다.',
      );
      throw new AppException('DISCORD_NOT_CONFIGURED', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const response = await fetch(
      `https://discord.com/api/guilds/${this.guildId}/members/${discordUserId}/roles/${roleId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${this.botToken}`,
          'Content-Length': '0',
        },
      },
    );

    if (response.status !== 204) {
      const errorText = await response.text();
      this.logger.error(`Discord assign role failed: status=${response.status}, body=${errorText}`);
      throw new AppException('DISCORD_GUILD_ADD_FAILED', HttpStatus.BAD_GATEWAY);
    }
  }
}
