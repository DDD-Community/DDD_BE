import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

import { MAX_CURSOR_LIMIT } from '../../../common/util/cursor';

export class CreateBlogPostRequestDto {
  @ApiProperty({ description: '블로그 제목', example: 'DDD 15기 활동 후기' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: '블로그 요약', example: 'DDD 15기에서의 경험을 공유합니다.' })
  @IsString()
  @IsNotEmpty()
  excerpt: string;

  @ApiPropertyOptional({
    description: '썸네일 URL',
    example: 'https://example.com/thumbnail.png',
  })
  @IsUrl()
  @IsOptional()
  thumbnail?: string;

  @ApiProperty({ description: '외부 링크 URL', example: 'https://medium.com/@ddd/post-1' })
  @IsUrl()
  @IsNotEmpty()
  externalUrl: string;
}

export class UpdateBlogPostRequestDto {
  @ApiPropertyOptional({ description: '블로그 제목', example: 'DDD 15기 활동 후기 (수정)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ description: '블로그 요약' })
  @IsString()
  @IsOptional()
  excerpt?: string;

  @ApiPropertyOptional({ description: '썸네일 URL' })
  @IsUrl()
  @IsOptional()
  thumbnail?: string;

  @ApiPropertyOptional({ description: '외부 링크 URL' })
  @IsUrl()
  @IsOptional()
  externalUrl?: string;
}

export class BlogCursorQueryDto {
  @ApiPropertyOptional({ description: '다음 페이지 커서(base64url)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '페이지 크기', minimum: 1, maximum: MAX_CURSOR_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CURSOR_LIMIT)
  limit?: number;
}
