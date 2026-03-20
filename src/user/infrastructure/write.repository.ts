import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import { UserType } from '../domain/user.type';

@Injectable()
export class WriteRepository {
  private readonly repo: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repo = dataSource.getRepository(User);
  }

  async create({ user }: { user: UserType }) {
    return this.repo.save(user);
  }

  async findOne({ email }: { email: string }) {
    return this.repo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .where('user.email = :email', { email })
      .getOne();
  }
}
