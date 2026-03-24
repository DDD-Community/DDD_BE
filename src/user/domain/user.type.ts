import type { User } from './user.entity';

export type UserType = {
  email: string;
  firstName: string;
  lastName?: string;
  sub: string;
  googleAccessToken?: string;
  googleRefreshToken?: string;
};

export type RegisterResult = {
  user: User;
  isNew: boolean;
};
