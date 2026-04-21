import { Column, Entity } from 'typeorm';

import { BaseEntity } from '../../common/core/base.entity';

@Entity('blog_posts')
export class BlogPost extends BaseEntity {
  @Column()
  title: string;

  @Column({ type: 'text' })
  excerpt: string;

  @Column({ nullable: true })
  thumbnail: string;

  @Column()
  externalUrl: string;

  static create({
    title,
    excerpt,
    thumbnail,
    externalUrl,
  }: {
    title: string;
    excerpt: string;
    thumbnail?: string;
    externalUrl: string;
  }): BlogPost {
    const post = new BlogPost();
    post.title = title;
    post.excerpt = excerpt;
    if (thumbnail) {
      post.thumbnail = thumbnail;
    }
    post.externalUrl = externalUrl;
    return post;
  }

  update({
    title,
    excerpt,
    thumbnail,
    externalUrl,
  }: {
    title?: string;
    excerpt?: string;
    thumbnail?: string;
    externalUrl?: string;
  }): void {
    if (title !== undefined) {
      this.title = title;
    }
    if (excerpt !== undefined) {
      this.excerpt = excerpt;
    }
    if (thumbnail !== undefined) {
      this.thumbnail = thumbnail;
    }
    if (externalUrl !== undefined) {
      this.externalUrl = externalUrl;
    }
  }
}
