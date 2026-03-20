import { HttpStatus, Injectable } from '@nestjs/common';

import { AppException } from '../../common/exception/app.exception';
import { AuthService } from '../../auth/application/auth.service';
import { UserService } from '../../user/application/user.service';
import type { GoogleProfile } from './google.type';

@Injectable()
export class GoogleAuthService {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  async googleLogin(profile: GoogleProfile) {
    if (!profile?.email) {
      throw new AppException('GOOGLE_AUTH_FAILED', HttpStatus.UNAUTHORIZED);
    }

    const { email, firstName, lastName, sub } = profile;
    const { user, isNew } = await this.userService.register({ email, firstName, lastName, sub });
    const accessToken = this.authService.signToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        roles: user.userRoles.map((ur) => ur.role),
        accessToken,
      },
      isNew,
    };
  }
}
