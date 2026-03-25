import { Injectable } from '@nestjs/common';
import { Transactional } from 'typeorm-transactional';

import { UserRepository } from '../domain/user.repository';
import type { RegisterResult, UserType } from '../domain/user.type';

@Injectable()
export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  @Transactional()
  async register({
    email,
    firstName,
    lastName,
    sub,
    googleAccessToken,
    googleRefreshToken,
  }: UserType): Promise<RegisterResult> {
    const found = await this.userRepository.findByEmail({ email, withDeleted: true });

    if (found) {
      const isNew = !!found.deletedAt;
      if (found.deletedAt) {
        await this.userRepository.restore({ id: found.id });
        found.deletedAt = null;
      }

      if (googleAccessToken || googleRefreshToken) {
        await this.userRepository.updateGoogleTokens({
          id: found.id,
          googleAccessToken,
          googleRefreshToken,
        });
      }
      return { user: found, isNew };
    }

    const user = await this.userRepository.register({
      email,
      firstName,
      lastName,
      sub,
      googleAccessToken,
      googleRefreshToken,
    });
    return { user, isNew: true };
  }

  async findById({ id }: { id: number }) {
    return this.userRepository.findById({ id });
  }

  async findByRefreshToken({ hash }: { hash: string }) {
    return this.userRepository.findByRefreshToken({ hash });
  }

  async saveRefreshToken({ id, refreshToken }: { id: number; refreshToken: string | null }) {
    await this.userRepository.saveRefreshToken({ id, refreshToken });
  }

  async withdraw({ id }: { id: number }) {
    await this.userRepository.withdraw({ id });
  }
}
