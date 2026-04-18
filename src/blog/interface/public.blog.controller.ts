import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { BlogService } from '../application/blog.service';
import { BlogPostResponseDto } from './dto/blog.response.dto';

@ApiTags('Blog')
@Controller({ path: 'blog-posts', version: '1' })
export class PublicBlogController {
  constructor(private readonly blogService: BlogService) {}

  @ApiDoc({
    summary: '블로그 게시글 목록 조회',
    description: '공개된 블로그 게시글 목록을 조회합니다. 외부 링크 목록을 제공합니다.',
    operationId: 'blog_getPublicList',
  })
  @Get()
  async findAllPosts() {
    const posts = await this.blogService.findAllPosts();
    return ApiResponse.ok(posts.map((post) => BlogPostResponseDto.from(post)));
  }
}
