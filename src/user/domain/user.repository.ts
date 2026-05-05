import { Injectable } from '@nestjs/common';

import type { UserType } from '../domain/user.type';
import { RoleWriteRepository } from '../infrastructure/role.write.repository';
import { WriteRepository } from '../infrastructure/write.repository';
import type { UserUpdatePatch } from '../infrastructure/write.repository.type';
import type { UserRole } from './user.role';

@Injectable()
export class UserRepository {
  constructor(
    private readonly writeRepository: WriteRepository,
    private readonly roleWriteRepository: RoleWriteRepository,
  ) {}

  async saveRoles({ userId, roles }: { userId: number; roles: UserRole[] }) {
    await this.roleWriteRepository.saveRoles({ userId, roles });
  }

  async countActiveByRole({ role }: { role: UserRole }): Promise<number> {
    return this.roleWriteRepository.countActiveByRole({ role });
  }

  async findByIdWithDeleted({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id }, includeRoles: true, withDeleted: true });
  }

  async findByEmail({ email, withDeleted = false }: { email: string; withDeleted?: boolean }) {
    return this.writeRepository.findOne({
      where: { email },
      includeRoles: true,
      withDeleted,
    });
  }

  async findById({ id }: { id: number }) {
    return this.writeRepository.findOne({ where: { id }, includeRoles: true });
  }

  async findByRefreshToken({ hash }: { hash: string }) {
    return this.writeRepository.findOne({
      where: { refreshToken: hash },
      includeRoles: true,
    });
  }

  async register({
    email,
    firstName,
    lastName,
    sub,
    googleAccessToken,
    googleRefreshToken,
  }: UserType) {
    return this.writeRepository.save({
      user: {
        email,
        firstName,
        lastName,
        sub,
        googleAccessToken,
        googleRefreshToken,
        userRoles: [{ role: [] }],
      },
    });
  }

  async saveRefreshToken({ id, refreshToken }: { id: number; refreshToken: string | null }) {
    const patch: UserUpdatePatch = { refreshToken };
    await this.writeRepository.update({ id, patch });
  }

  async withdraw({ id }: { id: number }) {
    await this.writeRepository.softDelete({ where: { id } });
  }

  async restore({ id }: { id: number }) {
    await this.writeRepository.restore({ where: { id } });
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
    const patch: UserUpdatePatch = {
      ...(googleAccessToken !== undefined && { googleAccessToken }),
      ...(googleRefreshToken !== undefined && { googleRefreshToken }),
    };
    const hasPatch = Object.keys(patch).length > 0;

    if (!hasPatch) {
      return;
    }

    await this.writeRepository.update({ id, patch });
  }
}
