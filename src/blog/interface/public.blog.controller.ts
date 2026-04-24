import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { BlogService } from '../application/blog.service';
import { BlogCursorQueryDto } from './dto/blog.request.dto';
import { BlogPostResponseDto } from './dto/blog.response.dto';

@ApiTags('Blog')
@Controller({ path: 'blog-posts', version: '1' })
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @ApiDoc({
    summary: '블로그 게시글 목록 조회',
    description: '공개된 블로그 게시글 목록을 커서 기반 페이지네이션으로 제공합니다.',
    operationId: 'blog_getPublicList',
  })
  @Get()
  async findAllPosts(@Query() query: BlogCursorQueryDto) {
    const { items, nextCursor, hasNext } = await this.blogService.findPostsByCursor({
      cursor: query.cursor,
      limit: query.limit,
    });

    return ApiResponse.ok(
      items.map((post) => BlogPostResponseDto.from(post)),
      'success',
      { nextCursor, hasNext },
    );
  }
}
