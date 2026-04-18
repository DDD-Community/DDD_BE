import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { JwtUser } from '../../auth/application/auth.type';
import { UserRole } from '../../user/domain/user.role';
import { ROLES_METADATA_KEY } from '../decorator/roles.decorator';
import { AppException } from '../exception/app.exception';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const userRoles = request.user?.roles ?? [];
    const hasRequiredRole = requiredRoles.some((requiredRole) => userRoles.includes(requiredRole));

    if (!hasRequiredRole) {
      throw new AppException('FORBIDDEN', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}
