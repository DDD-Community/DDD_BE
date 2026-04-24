import { ApiProperty } from '@nestjs/swagger';

import type { UploadResult } from '../../domain/storage.type';

export class FileUploadResponseDto {
  @ApiProperty({
    description: '업로드된 파일 URL',
    example: 'https://storage.googleapis.com/bucket/path/file.png',
  })
  url: string;

  @ApiProperty({ description: '원본 파일명', example: 'thumbnail.png' })
  originalName: string;

  @ApiProperty({ description: 'MIME 타입', example: 'image/png' })
  mimeType: string;

  @ApiProperty({ description: '파일 크기(bytes)', example: 1048576 })
  size: number;

  static from(result: UploadResult): FileUploadResponseDto {
    const dto = new FileUploadResponseDto();
    dto.url = result.url;
    dto.originalName = result.originalName;
    dto.mimeType = result.mimeType;
    dto.size = result.size;
    return dto;
  }
}
