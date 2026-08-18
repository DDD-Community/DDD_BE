import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';

import type { JwtUser } from '../../auth/application/auth.type';
import { AppException } from '../exception/app.exception';

@Injectable()
export class RejectApplicantSessionGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    if (request.user?.purpose === 'applicant') {
      throw new AppException('APPLICANT_SESSION_NOT_ALLOWED', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
