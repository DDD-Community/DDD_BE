import { ApiProperty } from '@nestjs/swagger';

import type { User } from '../../domain/user.entity';
import { UserRole } from '../../domain/user.role';

export class AdminUserResponseDto {
  @ApiProperty({ description: '사용자 ID', example: 1 })
  id: number;

  @ApiProperty({ description: '이메일', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: '이름', example: '석' })
  firstName: string;

  @ApiProperty({ description: '성', example: '왕', required: false })
  lastName?: string;

  @ApiProperty({ description: '활성 권한 목록', enum: UserRole, isArray: true })
  roles: UserRole[];

  @ApiProperty({ description: '가입 일시', example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;

  static from(user: User): AdminUserResponseDto {
    const dto = new AdminUserResponseDto();
    dto.id = user.id;
    dto.email = user.email;
    dto.firstName = user.firstName;
    dto.lastName = user.lastName;
    dto.roles = (user.userRoles ?? [])
      .filter((userRole) => !userRole.deletedAt)
      .flatMap((userRole) => userRole.role ?? []);
    dto.createdAt = user.createdAt;
    return dto;
  }
}
