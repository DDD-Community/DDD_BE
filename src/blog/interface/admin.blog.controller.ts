import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { BlogService } from '../application/blog.service';
import { CreateBlogPostRequestDto, UpdateBlogPostRequestDto } from './dto/blog.request.dto';
import { BlogPostResponseDto } from './dto/blog.response.dto';

@ApiTags('Admin - Blog')
@Controller({ path: 'admin/blog-posts', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminBlogController {
  constructor(private readonly blogService: BlogService) {}

  @ApiDoc({
    summary: '블로그 게시글 생성',
    description: '새로운 블로그 게시글을 생성합니다.',
    operationId: 'blog_createAdmin',
    auth: true,
  })
  @Post()
  async createPost(@Body() body: CreateBlogPostRequestDto) {
    const post = await this.blogService.createPost({ post: body });
    return ApiResponse.ok(BlogPostResponseDto.from(post));
  }

  @ApiDoc({
    summary: '블로그 게시글 전체 목록 조회',
    description: '모든 블로그 게시글을 조회합니다.',
    operationId: 'blog_getAdminList',
    auth: true,
  })
  @Get()
  async findAllPosts() {
    const posts = await this.blogService.findAllPosts();
    return ApiResponse.ok(posts.map((post) => BlogPostResponseDto.from(post)));
  }

  @ApiDoc({
    summary: '블로그 게시글 상세 조회',
    description: '특정 블로그 게시글의 상세 정보를 조회합니다.',
    operationId: 'blog_getAdminById',
    auth: true,
  })
  @Get(':id')
  async findPostById(@Param('id', ParseIntPipe) id: number) {
    const post = await this.blogService.findPostById({ id });
    return ApiResponse.ok(BlogPostResponseDto.from(post));
  }

  @ApiDoc({
    summary: '블로그 게시글 수정',
    description: '블로그 게시글 정보를 수정합니다.',
    operationId: 'blog_updateAdminById',
    auth: true,
  })
  @Patch(':id')
  async updatePost(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateBlogPostRequestDto) {
    await this.blogService.updatePost({ id, data: body });
    return ApiResponse.ok(null, '블로그 게시글이 수정되었습니다.');
  }

  @ApiDoc({
    summary: '블로그 게시글 삭제',
    description: '블로그 게시글을 소프트 삭제합니다.',
    operationId: 'blog_deleteAdminById',
    auth: true,
  })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(@Param('id', ParseIntPipe) id: number) {
    await this.blogService.deletePost({ id });
  }
}
