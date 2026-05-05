import { ApiProperty } from '@nestjs/swagger';

import type { User } from '../../domain/user.entity';
import { UserRole } from '../../domain/user.role';

export class AssignUserRolesResponseDto {
  @ApiProperty({ description: '대상 사용자 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '이메일', example: 'admin@example.com' })
  email: string;

  @ApiProperty({
    description: '부여된 권한 목록',
    enum: UserRole,
    isArray: true,
    example: [UserRole.계정관리],
  })
  roles: UserRole[];

  static from(user: User, roles: UserRole[]): AssignUserRolesResponseDto {
    const dto = new AssignUserRolesResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.roles = roles;
    return dto;
  }
}
