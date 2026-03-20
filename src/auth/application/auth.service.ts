import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { User } from '../../user/domain/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  signToken(user: User): string {
    const roles = user.userRoles ? user.userRoles.map((ur) => ur.role) : [];
    const payload = { sub: user.id, email: user.email, roles };
    return this.jwtService.sign(payload);
  }
}
