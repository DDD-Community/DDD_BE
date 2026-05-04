import { ApiProperty } from '@nestjs/swagger';

import type {
  ListFilesResult,
  SignedUrlResult,
  StorageObject,
  UploadResult,
} from '../../domain/storage.type';

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

export class StorageObjectDto {
  @ApiProperty({ description: 'GCS 객체 경로', example: 'projects/thumbnails/abc.png' })
  path: string;

  @ApiProperty({ description: '파일 크기(bytes)', example: 1048576 })
  size: number;

  @ApiProperty({ description: 'MIME 타입', example: 'image/png', nullable: true })
  contentType: string | null;

  @ApiProperty({
    description: '최종 수정 시각(ISO 8601)',
    example: '2026-04-28T12:00:00.000Z',
    nullable: true,
  })
  updatedAt: string | null;

  @ApiProperty({
    description: '공개 URL',
    example: 'https://storage.googleapis.com/bucket/projects/thumbnails/abc.png',
  })
  url: string;

  static from(object: StorageObject): StorageObjectDto {
    const dto = new StorageObjectDto();
    dto.path = object.path;
    dto.size = object.size;
    dto.contentType = object.contentType;
    dto.updatedAt = object.updatedAt;
    dto.url = object.url;
    return dto;
  }
}

export class ListFilesResponseDto {
  @ApiProperty({ type: [StorageObjectDto] })
  items: StorageObjectDto[];

  static from(result: ListFilesResult): ListFilesResponseDto {
    const dto = new ListFilesResponseDto();
    dto.items = result.items.map((item) => StorageObjectDto.from(item));
    return dto;
  }
}

export class SignedUrlResponseDto {
  @ApiProperty({
    description: '서명된 URL',
    example: 'https://storage.googleapis.com/bucket/path?X-Goog-Signature=...',
  })
  url: string;

  @ApiProperty({ description: '만료 시각(ISO 8601)', example: '2026-04-28T12:10:00.000Z' })
  expiresAt: string;

  static from(result: SignedUrlResult): SignedUrlResponseDto {
    const dto = new SignedUrlResponseDto();
    dto.url = result.url;
    dto.expiresAt = result.expiresAt;
    return dto;
  }
}
