import { JwtService } from '@nestjs/jwt';

import { UserRole } from '../../user/domain/user.role';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  describe('signToken', () => {
    it('user_roles의 enum 배열을 평탄화해서 JWT payload roles로 서명한다', () => {
      const sign = jest.fn().mockReturnValue('signed-token');
      const authService = new AuthService({ sign } as unknown as JwtService);

      const result = authService.signToken({
        id: 1,
        email: 'test@example.com',
        userRoles: [{ role: [UserRole.계정관리, UserRole.면접관] }, { role: [UserRole.계정관리] }],
      } as never);

      expect(result).toBe('signed-token');
      expect(sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
        roles: [UserRole.계정관리, UserRole.면접관],
      });
    });

    it('soft-delete된 user_roles 행의 role은 JWT payload에서 제외한다', () => {
      const sign = jest.fn().mockReturnValue('signed-token');
      const authService = new AuthService({ sign } as unknown as JwtService);

      const result = authService.signToken({
        id: 1,
        email: 'test@example.com',
        userRoles: [
          { role: [UserRole.계정관리], deletedAt: null },
          { role: [UserRole.면접관], deletedAt: new Date('2026-01-01') },
        ],
      } as never);

      expect(result).toBe('signed-token');
      expect(sign).toHaveBeenCalledWith({
        sub: 1,
        email: 'test@example.com',
        roles: [UserRole.계정관리],
      });
    });
  });
});
