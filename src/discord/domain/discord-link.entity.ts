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

  // 캐스트(::jsonb) 를 붙이면 안 된다. TypeORM 은 DB 의 기본값을 읽을 때 캐스트를 떼고
  // 비교하므로, 선언에만 캐스트가 남아 있으면 스키마가 동일한데도 매번 변경으로 판정한다.
  // 그 상태로는 migration:generate 가 영원히 같은 노이즈 마이그레이션을 만들어
  // CI 의 마이그레이션 누락 검사가 무의미해진다. 캐스트 없이 써도 Postgres 가
  // jsonb 로 강제 변환하므로 실제 컬럼 기본값은 '[]'::jsonb 로 동일하다.
  @Column({ type: 'jsonb', default: () => `'[]'` })
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
