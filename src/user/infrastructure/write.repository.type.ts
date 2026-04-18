import type { UserRole } from '../domain/user.role';

export type UserFindCondition = {
  id?: number;
  email?: string;
  refreshToken?: string;
};

export type UserUpdatePatch = {
  refreshToken?: string | null;
  googleAccessToken?: string;
  googleRefreshToken?: string;
};

export type UserRoleSavePatch = {
  role: UserRole[];
};

export type UserSavePatch = {
  email: string;
  firstName: string;
  lastName?: string;
  sub: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
  userRoles?: UserRoleSavePatch[];
};
