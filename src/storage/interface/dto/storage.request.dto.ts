import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { SignedUrlAction, UploadCategory } from '../../domain/storage.type';

export class FileUploadQueryDto {
  @ApiProperty({
    description: '업로드 카테고리',
    enum: UploadCategory,
    example: UploadCategory.PROJECT_THUMBNAIL,
  })
  @IsEnum(UploadCategory)
  category: UploadCategory;
}

export class ListFilesQueryDto {
  @ApiProperty({
    description: '카테고리(prefix)',
    enum: UploadCategory,
    example: UploadCategory.PROJECT_THUMBNAIL,
  })
  @IsEnum(UploadCategory)
  category: UploadCategory;

  @ApiPropertyOptional({ description: '다음 페이지 커서', example: 'pageToken-abc' })
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  cursor?: string;

  @ApiPropertyOptional({ description: '페이지 크기', example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class FilePathQueryDto {
  @ApiProperty({
    description: 'GCS 객체 경로 (카테고리 prefix로 시작해야 함)',
    example: 'projects/thumbnails/abc.png',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  path: string;
}

export class SignedUrlRequestDto {
  @ApiProperty({
    description: 'GCS 객체 경로 (카테고리 prefix로 시작해야 함)',
    example: 'projects/thumbnails/abc.png',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(1024)
  path: string;

  @ApiProperty({
    description: '서명 URL 동작',
    enum: SignedUrlAction,
    example: SignedUrlAction.READ,
  })
  @IsEnum(SignedUrlAction)
  action: SignedUrlAction;

  @ApiPropertyOptional({
    description: '만료 시간(초). 기본 600초, 최대 3600초',
    example: 600,
    minimum: 1,
    maximum: 3600,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3600)
  expiresInSeconds?: number;
}
