import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Project } from '../../domain/project.entity';
import { ProjectMember } from '../../domain/project-member.entity';
import { ProjectPlatform } from '../../domain/project-platform';

class ProjectMemberResponseDto {
  @ApiProperty({ description: '참여자 이름', example: '홍길동' })
  name: string;

  @ApiProperty({ description: '참여자 파트', example: 'BE' })
  part: string;

  static from(member: ProjectMember): ProjectMemberResponseDto {
    const dto = new ProjectMemberResponseDto();
    dto.name = member.name;
    dto.part = member.part;
    return dto;
  }
}

export class ProjectListResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiPropertyOptional({ description: '기수 이름', example: '15기' })
  cohortName: string | null;

  @ApiProperty({ description: '플랫폼 목록', enum: ProjectPlatform, isArray: true })
  platforms: ProjectPlatform[];

  @ApiProperty({ description: '서비스명', example: 'DDD 커뮤니티 앱' })
  name: string;

  @ApiProperty({ description: '한줄 설명', example: 'DDD 동아리 활동을 위한 커뮤니티 앱입니다.' })
  description: string;

  @ApiProperty({ description: '썸네일 URL', nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  static from(project: Project): ProjectListResponseDto {
    const dto = new ProjectListResponseDto();
    dto.id = project.id;
    dto.cohortId = project.cohortId;
    dto.cohortName = project.cohort?.name ?? null;
    dto.platforms = project.platforms;
    dto.name = project.name;
    dto.description = project.description;
    dto.thumbnailUrl = project.thumbnailUrl ?? null;
    dto.createdAt = project.createdAt;
    return dto;
  }
}

export class ProjectDetailResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '기수 ID', example: 1 })
  cohortId: number;

  @ApiPropertyOptional({ description: '기수 이름', example: '15기' })
  cohortName: string | null;

  @ApiProperty({ description: '플랫폼 목록', enum: ProjectPlatform, isArray: true })
  platforms: ProjectPlatform[];

  @ApiProperty({ description: '서비스명', example: 'DDD 커뮤니티 앱' })
  name: string;

  @ApiProperty({ description: '한줄 설명' })
  description: string;

  @ApiProperty({ description: '썸네일 URL', nullable: true })
  thumbnailUrl: string | null;

  @ApiProperty({ description: 'PDF URL', nullable: true })
  pdfUrl: string | null;

  @ApiProperty({ description: '참여자 목록', type: [ProjectMemberResponseDto] })
  members: ProjectMemberResponseDto[];

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  static from(project: Project): ProjectDetailResponseDto {
    const dto = new ProjectDetailResponseDto();
    dto.id = project.id;
    dto.cohortId = project.cohortId;
    dto.cohortName = project.cohort?.name ?? null;
    dto.platforms = project.platforms;
    dto.name = project.name;
    dto.description = project.description;
    dto.thumbnailUrl = project.thumbnailUrl ?? null;
    dto.pdfUrl = project.pdfUrl ?? null;
    dto.members = (project.members ?? []).map((member) => ProjectMemberResponseDto.from(member));
    dto.createdAt = project.createdAt;
    dto.updatedAt = project.updatedAt;
    return dto;
  }
}
