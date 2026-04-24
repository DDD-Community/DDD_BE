import { Column, Entity, Index } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';
import type { DiscordLinkCreateInput } from './discord.type';

@Entity('discord_links')
@Index('uq_discord_links_application_active', ['applicationFormId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
@Index('uq_discord_links_discord_user_active', ['discordUserId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class DiscordLink extends BaseEntity {
  @Column()
  applicationFormId: number;

  @Column()
  discordUserId: string;

  @Column()
  discordUsername: string;

  @Column({ type: 'jsonb', default: () => `'[]'::jsonb` })
  rolesAssigned: string[];

  @Column({ nullable: true })
  invitedAt?: Date;

  static create(input: DiscordLinkCreateInput): DiscordLink {
    const link = new DiscordLink();
    link.applicationFormId = input.applicationFormId;
    link.discordUserId = input.discordUserId;
    link.discordUsername = input.discordUsername;
    link.rolesAssigned = input.rolesAssigned;
    link.invitedAt = input.invitedAt ?? new Date();
    return link;
  }

  markInvited({ rolesAssigned, invitedAt }: { rolesAssigned: string[]; invitedAt: Date }): void {
    this.rolesAssigned = rolesAssigned;
    this.invitedAt = invitedAt;
  }
}
