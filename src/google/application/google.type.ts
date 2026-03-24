import { UserRole } from '../../user/domain/user.role';

export type GoogleProfile = {
  email: string;
  firstName: string;
  lastName: string;
  sub: string;
  accessToken: string;
  refreshToken?: string;
};

export type GoogleLoginResult = {
  user: {
    id: number;
    email: string;
    roles: UserRole[];
    accessToken: string;
    refreshToken: string;
  };
  isNew: boolean;
};

export type GoogleAuthCallbackResult = {
  accessToken: string;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type GoogleRefreshResult = {
  accessToken: string;
};
