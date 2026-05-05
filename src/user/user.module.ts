import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { UserService } from './application/user.service';
import { User } from './domain/user.entity';
import { UserRepository } from './domain/user.repository';
import { UserRoleEntity } from './domain/user-role.entity';
import { RoleWriteRepository } from './infrastructure/role.write.repository';
import { WriteRepository } from './infrastructure/write.repository';
import { BootstrapUserController } from './interface/bootstrap.user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRoleEntity]), AuditModule],
  controllers: [BootstrapUserController],
  providers: [UserService, UserRepository, WriteRepository, RoleWriteRepository],
  exports: [UserService],
})
export class UserModule {}
