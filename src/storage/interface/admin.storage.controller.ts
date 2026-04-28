import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { StorageService } from '../application/storage.service';
import {
  FilePathQueryDto,
  FileUploadQueryDto,
  ListFilesQueryDto,
  SignedUrlRequestDto,
} from './dto/storage.request.dto';
import {
  FileUploadResponseDto,
  ListFilesResponseDto,
  SignedUrlResponseDto,
} from './dto/storage.response.dto';

@ApiTags('Admin - Storage')
@Controller({ path: 'admin/files', version: '1' })
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.계정관리, UserRole.운영자)
export class AdminStorageController {
  constructor(private readonly storageService: StorageService) {}

  @ApiDoc({
    summary: '파일 업로드',
    description: '카테고리별 파일을 업로드하고 URL을 반환합니다.',
    operationId: 'storage_uploadFile',
    auth: true,
  })
  @ApiConsumes('multipart/form-data')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File, @Query() query: FileUploadQueryDto) {
    const filePayload = file
      ? {
          buffer: file.buffer,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        }
      : null;

    const result = await this.storageService.upload({
      file: filePayload,
      category: query.category,
    });

    return ApiResponse.ok(FileUploadResponseDto.from(result));
  }

  @ApiDoc({
    summary: '파일 목록 조회',
    description: '카테고리별 GCS 객체 목록을 커서 기반 페이지네이션으로 조회합니다.',
    operationId: 'storage_listFiles',
    auth: true,
  })
  @Get()
  async listFiles(@Query() query: ListFilesQueryDto) {
    const result = await this.storageService.listFiles({
      category: query.category,
      cursor: query.cursor,
      limit: query.limit,
    });

    return ApiResponse.ok(ListFilesResponseDto.from(result), 'success', {
      nextCursor: result.nextCursor,
      hasNext: result.hasNext,
    });
  }

  @ApiDoc({
    summary: '파일 삭제',
    description: 'GCS 객체를 삭제합니다. 카테고리 prefix에 속한 경로만 허용됩니다.',
    operationId: 'storage_deleteFile',
    auth: true,
  })
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteFile(@Query() query: FilePathQueryDto): Promise<void> {
    await this.storageService.deleteFile({ path: query.path });
  }

  @ApiDoc({
    summary: '서명 URL 생성',
    description:
      'V4 서명 URL을 생성합니다. action=read 는 다운로드용, action=write 는 업로드용입니다.',
    operationId: 'storage_createSignedUrl',
    auth: true,
  })
  @Post('signed-url')
  @HttpCode(HttpStatus.OK)
  async createSignedUrl(@Body() body: SignedUrlRequestDto) {
    const result = await this.storageService.generateSignedUrl({
      path: body.path,
      action: body.action,
      expiresInSeconds: body.expiresInSeconds,
    });

    return ApiResponse.ok(SignedUrlResponseDto.from(result));
  }

  @ApiDoc({
    summary: '파일 다운로드',
    description: 'GCS 객체를 스트림으로 다운로드합니다.',
    operationId: 'storage_downloadFile',
    auth: true,
  })
  @Get('download')
  async download(
    @Query() query: FilePathQueryDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const result = await this.storageService.download({ path: query.path });

    const headers: Record<string, string> = {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
    };
    if (result.contentLength !== null) {
      headers['Content-Length'] = String(result.contentLength);
    }
    response.set(headers);

    return new StreamableFile(result.stream);
  }
}
