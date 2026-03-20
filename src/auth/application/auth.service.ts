import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import type { User } from '../../user/domain/user.entity';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  signToken({ id, email, userRoles }: User): string {
    const roles = userRoles ? userRoles.map((userRole) => userRole.role) : [];
    const payload = { sub: id, email, roles };
    return this.jwtService.sign(payload);
  }
}
