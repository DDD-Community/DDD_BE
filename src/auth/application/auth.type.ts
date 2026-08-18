import { UserRole } from '../../user/domain/user.role';

export type JwtPayload = {
  sub: number;
  email: string;
  roles: UserRole[];
  purpose?: 'applicant';
};

export type JwtUser = {
  id: number;
  email: string;
  roles: UserRole[];
  purpose?: 'applicant';
};

export type RefreshTokenResult = {
  token: string;
  hash: string;
};
