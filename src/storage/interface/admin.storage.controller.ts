import { Controller, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';

import { Roles } from '../../common/decorator/roles.decorator';
import { RolesGuard } from '../../common/guard/roles.guard';
import { ApiResponse } from '../../common/response/api-response';
import { ApiDoc } from '../../common/swagger/api-doc.decorator';
import { UserRole } from '../../user/domain/user.role';
import { StorageService } from '../application/storage.service';
import { FileUploadQueryDto } from './dto/storage.request.dto';
import { FileUploadResponseDto } from './dto/storage.response.dto';

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
}
