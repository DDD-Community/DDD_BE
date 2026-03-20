import { HttpStatus, Injectable } from '@nestjs/common';

import { AuthService } from '../../auth/application/auth.service';
import { AppException } from '../../common/exception/app.exception';
import { UserService } from '../../user/application/user.service';
import type { GoogleProfile } from './google.type';

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  async googleLogin({ email, firstName, lastName, sub }: GoogleProfile) {
    if (!email) {
      throw new AppException('GOOGLE_AUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const { user, isNew } = await this.userService.register({ email, firstName, lastName, sub });
    const accessToken = this.authService.signToken(user);
    const roles = (user.userRoles ?? []).map((userRole) => userRole.role);

    return {
      user: {
        id: user.id,
        email: user.email,
        roles,
        accessToken,
      },
      isNew,
    };
  }
}
