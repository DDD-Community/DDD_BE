import { UserRole } from '../../user/domain/user.role';

export type GoogleProfile = {
  email: string;
  firstName: string;
  lastName: string;
  sub: string;
  accessToken: string;
};

export type GoogleLoginResult = {
  user: {
    id: number;
    email: string;
    roles: UserRole[];
    accessToken: string;
  };
  isNew: boolean;
};
