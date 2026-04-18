import { ApiProperty } from '@nestjs/swagger';

import { BlogPost } from '../../domain/blog-post.entity';

export class BlogPostResponseDto {
  @ApiProperty({ description: 'ID', example: 1 })
  id: number;

  @ApiProperty({ description: '블로그 제목', example: 'DDD 15기 활동 후기' })
  title: string;

  @ApiProperty({ description: '블로그 요약', example: 'DDD 15기에서의 경험을 공유합니다.' })
  excerpt: string;

  @ApiProperty({ description: '썸네일 URL', nullable: true })
  thumbnail: string | null;

  @ApiProperty({ description: '외부 링크 URL', example: 'https://medium.com/@ddd/post-1' })
  externalUrl: string;

  @ApiProperty({ description: '생성 일시' })
  createdAt: Date;

  @ApiProperty({ description: '수정 일시' })
  updatedAt: Date;

  static from(post: BlogPost): BlogPostResponseDto {
    const dto = new BlogPostResponseDto();
    dto.id = post.id;
    dto.title = post.title;
    dto.excerpt = post.excerpt;
    dto.thumbnail = post.thumbnail ?? null;
    dto.externalUrl = post.externalUrl;
    dto.createdAt = post.createdAt;
    dto.updatedAt = post.updatedAt;
    return dto;
  }
}
