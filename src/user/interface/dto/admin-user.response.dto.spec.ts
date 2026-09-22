import { User } from '../../domain/user.entity';
import { UserRole } from '../../domain/user.role';
import { UserRoleEntity } from '../../domain/user-role.entity';
import { AdminUserResponseDto } from './admin-user.response.dto';

describe('AdminUserResponseDto', () => {
  it('허용한 목록 필드와 활성 권한만 직렬화한다', () => {
    const user = Object.assign(new User(), {
      id: 3,
      email: 'user@example.com',
      firstName: '길동',
      lastName: '홍',
      createdAt: new Date('2026-01-02T00:00:00Z'),
      sub: 'private-sub',
      refreshToken: 'private-refresh',
      googleAccessToken: 'private-access',
      googleRefreshToken: 'private-google-refresh',
      userRoles: [
        Object.assign(new UserRoleEntity(), { role: [UserRole.운영자], deletedAt: null }),
        Object.assign(new UserRoleEntity(), {
          role: [UserRole.계정관리],
          deletedAt: new Date('2026-01-01T00:00:00Z'),
        }),
      ],
    });

    const result: unknown = JSON.parse(JSON.stringify(AdminUserResponseDto.from(user)));

    expect(result).toEqual({
      id: 3,
      email: 'user@example.com',
      firstName: '길동',
      lastName: '홍',
      roles: [UserRole.운영자],
      createdAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('성이나 권한 행이 없어도 빈 권한 목록을 반환한다', () => {
    const user = Object.assign(new User(), {
      id: 3,
      email: 'user@example.com',
      firstName: '길동',
      createdAt: new Date('2026-01-02T00:00:00Z'),
    });

    const result = AdminUserResponseDto.from(user);

    expect(result.roles).toEqual([]);
    expect(result.lastName).toBeUndefined();
  });
});
