import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsEnum } from 'class-validator';

import { UserRole } from '../../domain/user.role';

export class AssignUserRolesRequestDto {
  @ApiProperty({
    description: '대상 사용자에게 부여할 권한 목록 (전체 교체)',
    enum: UserRole,
    isArray: true,
    example: [UserRole.계정관리],
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles: UserRole[];
}
