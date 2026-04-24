import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

import { UploadCategory } from '../../domain/storage.type';

export class FileUploadQueryDto {
  @ApiProperty({
    description: '업로드 카테고리',
    enum: UploadCategory,
    example: UploadCategory.PROJECT_THUMBNAIL,
  })
  @IsEnum(UploadCategory)
  category: UploadCategory;
}
