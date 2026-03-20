import { Injectable } from '@nestjs/common';

import { UserRepository } from '../domain/user.repository';
import { UserType } from '../domain/user.type';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async register({ email, firstName, lastName, sub }: UserType) {
    const found = await this.userRepository.findByEmail({ email });

    if (found) {
      return { user: found, isNew: false };
    }

    const user = await this.userRepository.register({ email, firstName, lastName, sub });
    return { user, isNew: true };
  }
}
