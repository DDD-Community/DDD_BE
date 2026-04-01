import { Injectable } from '@nestjs/common';

import { WriteRepository } from '../infrastructure/write.repository';
import type { UserType } from './user.type';

@Injectable()
export class UserRepository {
  constructor(private readonly writeRepository: WriteRepository) {}

  async findByEmail({ email, withDeleted = false }: { email: string; withDeleted?: boolean }) {
    return this.writeRepository.findOne({ email }, withDeleted);
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ id });
  }

  async findByRefreshToken({ hash }: { hash: string }) {
    return this.writeRepository.findOne({ refreshToken: hash });
  }

  async register({
    email,
    firstName,
    lastName,
    sub,
    googleAccessToken,
    googleRefreshToken,
  }: UserType) {
    return this.writeRepository.create({
      user: { email, firstName, lastName, sub, googleAccessToken, googleRefreshToken },
    });
  }

  async saveRefreshToken({ id, refreshToken }: { id: number; refreshToken: string | null }) {
    await this.writeRepository.update({ id, refreshToken });
  }

  async withdraw({ id }: { id: number }) {
    await this.writeRepository.softDelete({ id });
  }

  async restore({ id }: { id: number }) {
    await this.writeRepository.restore({ id });
  }

  async updateGoogleTokens({
    id,
    googleAccessToken,
    googleRefreshToken,
  }: {
    id: number;
    googleAccessToken?: string;
    googleRefreshToken?: string;
  }) {
    await this.writeRepository.updateGoogleTokens({ id, googleAccessToken, googleRefreshToken });
  }
}
