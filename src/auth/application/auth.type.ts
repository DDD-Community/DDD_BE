import { UserRole } from '../../user/domain/user.role';

export type JwtPayload = {
  sub: number;
  email: string;
  roles: UserRole[];
};

export type JwtUser = {
  id: number;
  email: string;
  roles: UserRole[];
};
