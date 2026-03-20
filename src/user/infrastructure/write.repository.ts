import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { User } from '../domain/user.entity';
import { UserType } from '../domain/user.type';

@Injectable()
export class WriteRepository {
  private readonly repository: Repository<User>;

  constructor(dataSource: DataSource) {
    this.repository = dataSource.getRepository(User);
  }

  async create({ user }: { user: UserType }) {
    return this.repository.save(user);
  }

  async findOne({ email }: { email: string }) {
    return this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .where('user.email = :email', { email })
      .getOne();
  }
}
