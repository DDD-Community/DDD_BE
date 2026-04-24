import { Injectable } from '@nestjs/common';

import { DiscordWriteRepository } from '../infrastructure/discord.write.repository';
import { DiscordLink } from './discord-link.entity';

@Injectable()
export class DiscordRepository {
  constructor(private readonly discordWriteRepository: DiscordWriteRepository) {}

  async save({ link }: { link: DiscordLink }): Promise<DiscordLink> {
    return this.discordWriteRepository.save({ link });
  }

  async findByApplicationFormId({ applicationFormId }: { applicationFormId: number }) {
    return this.discordWriteRepository.findOne({ where: { applicationFormId } });
  }

  async findByDiscordUserId({ discordUserId }: { discordUserId: string }) {
    return this.discordWriteRepository.findOne({ where: { discordUserId } });
  }

  async findById({ id }: { id: number }) {
    return this.discordWriteRepository.findOne({ where: { id } });
  }

  async deleteById({ id }: { id: number }): Promise<void> {
    await this.discordWriteRepository.softDelete({ id });
  }
}
