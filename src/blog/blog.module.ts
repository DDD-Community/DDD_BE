import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RolesGuard } from '../common/guard/roles.guard';
import { BlogService } from './application/blog.service';
import { BlogRepository } from './domain/blog.repository';
import { BlogPost } from './domain/blog-post.entity';
import { WriteRepository } from './infrastructure/write.repository';
import { AdminBlogController } from './interface/admin.blog.controller';
import { PublicBlogController } from './interface/public.blog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost])],
  controllers: [AdminBlogController, PublicBlogController],
  providers: [BlogService, BlogRepository, WriteRepository, RolesGuard],
  exports: [BlogService],
})
export class BlogModule {}
