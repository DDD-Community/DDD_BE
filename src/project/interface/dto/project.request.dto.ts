import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';

import { ProjectPlatform } from '../../domain/project-platform';

export class ProjectMemberRequestDto {
  @ApiProperty({ description: '참여자 이름', example: '홍길동' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '참여자 파트', example: 'BE' })
  @IsString()
  @IsNotEmpty()
  part: string;
}

export class CreateProjectRequestDto {
  @ApiProperty({ description: '기수 ID', example: 1 })
  @IsInt()
  cohortId: number;

  @ApiProperty({
    description: '플랫폼 목록',
    enum: ProjectPlatform,
    isArray: true,
    example: [ProjectPlatform.IOS, ProjectPlatform.AOS],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ProjectPlatform, { each: true })
  platforms: ProjectPlatform[];

  @ApiProperty({ description: '프로젝트(서비스) 이름', example: 'DDD 커뮤니티 앱' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: '프로젝트 한줄 설명',
    example: 'DDD 동아리 활동을 위한 커뮤니티 앱입니다.',
  })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: '썸네일 URL', example: 'https://example.com/thumbnail.png' })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'PDF URL', example: 'https://example.com/project.pdf' })
  @IsUrl()
  @IsOptional()
  pdfUrl?: string;

  @ApiPropertyOptional({ description: '참여자 목록', type: [ProjectMemberRequestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberRequestDto)
  @IsOptional()
  members?: ProjectMemberRequestDto[];
}

export class UpdateProjectRequestDto {
  @ApiPropertyOptional({
    description: '플랫폼 목록',
    enum: ProjectPlatform,
    isArray: true,
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(ProjectPlatform, { each: true })
  @IsOptional()
  platforms?: ProjectPlatform[];

  @ApiPropertyOptional({ description: '프로젝트(서비스) 이름' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '프로젝트 한줄 설명' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '썸네일 URL' })
  @IsUrl()
  @IsOptional()
  thumbnailUrl?: string;

  @ApiPropertyOptional({ description: 'PDF URL' })
  @IsUrl()
  @IsOptional()
  pdfUrl?: string;
}

export class UpdateProjectMembersRequestDto {
  @ApiProperty({ description: '참여자 목록', type: [ProjectMemberRequestDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectMemberRequestDto)
  members: ProjectMemberRequestDto[];
}

export class ProjectListQueryDto {
  @ApiPropertyOptional({
    description: '플랫폼 필터 (미지정 시 전체 조회)',
    enum: ProjectPlatform,
  })
  @IsEnum(ProjectPlatform)
  @IsOptional()
  platform?: ProjectPlatform;
}
