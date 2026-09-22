import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import { MAX_CURSOR_LIMIT } from '../../../common/util/cursor';
import { AssignUserRolesRequestDto } from './bootstrap-user.request.dto';

export class AdminUserCursorQueryDto {
  @ApiPropertyOptional({ description: '이메일 검색어 (대소문자 무시 부분 일치)' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({ description: '다음 페이지 커서(base64url)' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ description: '페이지 크기', minimum: 1, maximum: MAX_CURSOR_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CURSOR_LIMIT)
  limit?: number;
}

export class AdminAssignUserRolesRequestDto extends AssignUserRolesRequestDto {}
