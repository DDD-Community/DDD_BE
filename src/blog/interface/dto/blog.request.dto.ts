import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

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
