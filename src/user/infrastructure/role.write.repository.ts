import { Injectable } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';

import { UserRole } from '../domain/user.role';
import { UserRoleEntity } from '../domain/user-role.entity';

@Injectable()
export class RoleWriteRepository {
  private readonly repository: Repository<UserRoleEntity>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(UserRoleEntity);
  }

  async findActiveByUserId({ userId }: { userId: number }) {
    return this.repository.findOne({ where: { userId, deletedAt: IsNull() } });
  }

  async saveRoles({ userId, roles }: { userId: number; roles: UserRole[] }) {
    const found = await this.findActiveByUserId({ userId });
    if (found) {
      found.role = roles;
      await this.repository.save(found);
      return;
    }

    const created = this.repository.create({ userId, role: roles });
    await this.repository.save(created);
  }
}
