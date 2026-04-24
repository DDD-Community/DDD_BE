import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { ApplicationService } from '../../application/usecase/application.service';
import { AppException } from '../../common/exception/app.exception';
import { isPostgresUniqueViolation } from '../../common/util/postgres-error';
import { DiscordRepository } from '../domain/discord.repository';
import type { LinkApplicantCommand } from '../domain/discord.type';
import { DiscordLink } from '../domain/discord-link.entity';
import { DiscordBotClient } from '../infrastructure/discord-bot.client';
import { DiscordOauthClient } from '../infrastructure/discord-oauth.client';
import { DiscordInviteService } from './discord-invite.service';

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(
    private readonly discordRepository: DiscordRepository,
    private readonly discordOauthClient: DiscordOauthClient,
    private readonly discordBotClient: DiscordBotClient,
    private readonly discordInviteService: DiscordInviteService,
    private readonly applicationService: ApplicationService,
  ) {}

  buildAuthorizeUrl({ applicationFormId }: { applicationFormId: number }): string {
    // state encodes applicationFormId so the callback can reconstruct it
    const state = String(applicationFormId);
    return this.discordOauthClient.buildAuthorizeUrl({ state });
  }

  @Transactional()
  async linkApplicant(command: LinkApplicantCommand): Promise<DiscordLink> {
    const form = await this.applicationService.findFormById({ id: command.applicationFormId });

    const existing = await this.discordRepository.findByApplicationFormId({
      applicationFormId: command.applicationFormId,
    });
    if (existing) {
      throw new AppException('DISCORD_ALREADY_LINKED', HttpStatus.CONFLICT);
    }

    const token = await this.discordOauthClient.exchangeCode({ code: command.oauthCode });
    const discordUser = await this.discordOauthClient.fetchCurrentUser({
      accessToken: token.accessToken,
    });

    const duplicateDiscordUser = await this.discordRepository.findByDiscordUserId({
      discordUserId: discordUser.id,
    });
    if (duplicateDiscordUser) {
      throw new AppException('DISCORD_ALREADY_LINKED', HttpStatus.CONFLICT);
    }

    const roleIds = this.discordInviteService.resolveRoleIds({
      partName: form.cohortPart.partName,
    });

    try {
      await this.discordBotClient.addGuildMember({
        discordUserId: discordUser.id,
        accessToken: token.accessToken,
        roleIds,
      });
    } catch (error) {
      this.logger.error(
        `Discord guild add failed for applicationFormId=${command.applicationFormId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error instanceof AppException
        ? error
        : new AppException('DISCORD_GUILD_ADD_FAILED', HttpStatus.BAD_GATEWAY);
    }

    const link = DiscordLink.create({
      applicationFormId: command.applicationFormId,
      discordUserId: discordUser.id,
      discordUsername: discordUser.username,
      rolesAssigned: roleIds,
      invitedAt: new Date(),
    });

    try {
      return await this.discordRepository.save({ link });
    } catch (error) {
      if (isPostgresUniqueViolation(error)) {
        throw new AppException('DISCORD_ALREADY_LINKED', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async findByApplicationFormId({ applicationFormId }: { applicationFormId: number }) {
    const link = await this.discordRepository.findByApplicationFormId({ applicationFormId });
    if (!link) {
      throw new AppException('DISCORD_LINK_NOT_FOUND', HttpStatus.NOT_FOUND);
    }
    return link;
  }
}
