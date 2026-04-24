import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from '../application/application.module';
import { DiscordService } from './application/discord.service';
import { DiscordInviteService } from './application/discord-invite.service';
import { DiscordRepository } from './domain/discord.repository';
import { DiscordLink } from './domain/discord-link.entity';
import { DiscordWriteRepository } from './infrastructure/discord.write.repository';
import { DiscordBotClient } from './infrastructure/discord-bot.client';
import { DiscordOauthClient } from './infrastructure/discord-oauth.client';
import { PublicDiscordController } from './interface/public.discord.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DiscordLink]), forwardRef(() => ApplicationModule)],
  controllers: [PublicDiscordController],
  providers: [
    DiscordService,
    DiscordInviteService,
    DiscordRepository,
    DiscordWriteRepository,
    DiscordOauthClient,
    DiscordBotClient,
  ],
  exports: [DiscordService, DiscordInviteService],
})
export class DiscordModule {}
