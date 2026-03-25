import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import { UserType } from '../domain/user.type';

type UserFindCondition = {
  email?: string;
  id?: number;
  refreshToken?: string;
};

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(User);
  }

  async create({ user }: { user: UserType }) {
    return this.repository.save(user);
  }

  async softDelete({ id }: { id: number }) {
    await this.repository.softDelete(id);
  }

  async restore({ id }: { id: number }) {
    await this.repository.restore(id);
  }

  async findOne(condition: UserFindCondition, withDeleted = false) {
    return this.repository.findOne({
      where: condition,
      relations: { userRoles: true },
      withDeleted,
    });
  }

  async update({ id, refreshToken }: { id: number; refreshToken: string | null }) {
    await this.repository.update(id, { refreshToken });
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
    const updateData: Partial<User> = {};
    if (googleAccessToken !== undefined) {
      updateData.googleAccessToken = googleAccessToken;
    }
    if (googleRefreshToken !== undefined) {
      updateData.googleRefreshToken = googleRefreshToken;
    }
    if (Object.keys(updateData).length > 0) {
      await this.repository.update(id, updateData);
    }
  }
}
