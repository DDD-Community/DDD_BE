import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserService } from './application/user.service';
import { UserRoleEntity } from './domain/user-role.entity';
import { UserRepository } from './domain/user.repository';
import { User } from './domain/user.entity';
import { WriteRepository } from './infrastructure/write.repository';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRoleEntity])],
  providers: [UserService, UserRepository, WriteRepository],
  exports: [UserService],
})
export class UserModule {}
