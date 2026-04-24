import { Injectable } from '@nestjs/common';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';

import { DiscordLink } from '../domain/discord-link.entity';
import type { DiscordLinkFilter } from './write.repository.type';

@Injectable()
export class DiscordWriteRepository {
  private readonly repository: Repository<DiscordLink>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(DiscordLink);
  }

  async save({ link }: { link: DiscordLink }): Promise<DiscordLink> {
    return this.repository.save(link);
  }

  async findOne({ where }: { where: DiscordLinkFilter }) {
    return this.repository.findOne({ where: this.buildWhere(where) });
  }

  async findMany({ where = {} }: { where?: DiscordLinkFilter } = {}) {
    return this.repository.find({
      where: this.buildWhere(where),
      order: { createdAt: 'DESC' },
    });
  }

  async softDelete({ id }: { id: number }): Promise<void> {
    await this.repository.softDelete(id);
  }

  private buildWhere(filter: DiscordLinkFilter): FindOptionsWhere<DiscordLink> {
    const where: FindOptionsWhere<DiscordLink> = {};
    if (filter.id !== undefined) {
      where.id = filter.id;
    }
    if (filter.applicationFormId !== undefined) {
      where.applicationFormId = filter.applicationFormId;
    }
    if (filter.discordUserId !== undefined) {
      where.discordUserId = filter.discordUserId;
    }
    return where;
  }
}
