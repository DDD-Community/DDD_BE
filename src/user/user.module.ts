import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { RejectApplicantSessionGuard } from '../common/guard/reject-applicant-session.guard';
import { UserService } from './application/user.service';
import { User } from './domain/user.entity';
import { UserRepository } from './domain/user.repository';
import { UserRoleEntity } from './domain/user-role.entity';
import { RoleWriteRepository } from './infrastructure/role.write.repository';
import { WriteRepository } from './infrastructure/write.repository';
import { BootstrapUserController } from './interface/bootstrap.user.controller';
import { UserController } from './interface/user.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRoleEntity]), AuditModule],
  controllers: [BootstrapUserController, UserController],
  providers: [
    UserService,
    UserRepository,
    WriteRepository,
    RoleWriteRepository,
    RejectApplicantSessionGuard,
  ],
  exports: [UserService],
})
export class UserModule {}
