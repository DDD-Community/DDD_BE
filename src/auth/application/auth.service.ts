import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';

import type { User } from '../../user/domain/user.entity';
import { UserRole } from '../../user/domain/user.role';
import type { RefreshTokenResult } from './auth.type';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  signToken({ id, email, userRoles }: User): string {
    const roles = this.extractRoles({ userRoles });
    const payload = { sub: id, email, roles };
    return this.jwtService.sign(payload);
  }

  extractRoles({ userRoles }: Pick<User, 'userRoles'>): UserRole[] {
    const roles = (userRoles ?? [])
      .filter((userRole) => !userRole.deletedAt)
      .flatMap((userRole) => userRole.role ?? []);
    return [...new Set(roles)];
  }

  generateRefreshToken(): RefreshTokenResult {
    const token = randomBytes(32).toString('hex');
    const hash = this.sha256({ input: token });
    return { token, hash };
  }

  hashRefreshToken({ token }: { token: string }): string {
    return this.sha256({ input: token });
  }

  private sha256({ input }: { input: string }): string {
    const hasher = createHash('sha256');
    hasher.update(input);
    return hasher.digest('hex');
  }
}
