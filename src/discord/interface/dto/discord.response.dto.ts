import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DiscordLink } from '../../domain/discord-link.entity';

export class DiscordLinkResponseDto {
  @ApiProperty({ description: '연동 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '지원서 ID', example: 1 })
  applicationFormId: number;

  @ApiProperty({ description: 'Discord 사용자 ID', example: '1234567890' })
  discordUserId: string;

  @ApiProperty({ description: 'Discord 사용자 이름', example: 'ddd_applicant' })
  discordUsername: string;

  @ApiProperty({ description: '할당된 Role ID 목록', type: [String] })
  rolesAssigned: string[];

  @ApiPropertyOptional({ description: 'Discord 서버 초대 완료 시각', nullable: true })
  invitedAt: Date | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(link: DiscordLink): DiscordLinkResponseDto {
    const dto = new DiscordLinkResponseDto();
    dto.id = link.id;
    dto.applicationFormId = link.applicationFormId;
    dto.discordUserId = link.discordUserId;
    dto.discordUsername = link.discordUsername;
    dto.rolesAssigned = link.rolesAssigned ?? [];
    dto.invitedAt = link.invitedAt ?? null;
    dto.createdAt = link.createdAt;
    return dto;
  }
}

export class DiscordAuthorizeResponseDto {
  @ApiProperty({ description: 'Discord OAuth 동의 페이지 URL' })
  authorizeUrl: string;

  static of({ authorizeUrl }: { authorizeUrl: string }): DiscordAuthorizeResponseDto {
    const dto = new DiscordAuthorizeResponseDto();
    dto.authorizeUrl = authorizeUrl;
    return dto;
  }
}
