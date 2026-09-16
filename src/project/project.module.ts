import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RolesGuard } from '../common/guard/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { ProjectService } from './application/project.service';
import { ProjectAssetPurgeService } from './application/project-asset-purge.service';
import { Project } from './domain/project.entity';
import { ProjectRepository } from './domain/project.repository';
import { ProjectMember } from './domain/project-member.entity';
import { MemberWriteRepository } from './infrastructure/member.write.repository';
import { ProjectAssetPurgeScheduler } from './infrastructure/project-asset-purge.scheduler';
import { WriteRepository } from './infrastructure/write.repository';
import { AdminProjectController } from './interface/admin.project.controller';
import { PublicProjectController } from './interface/public.project.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectMember]), StorageModule],
  controllers: [AdminProjectController, PublicProjectController],
  providers: [
    ProjectService,
    ProjectAssetPurgeService,
    ProjectAssetPurgeScheduler,
    ProjectRepository,
    WriteRepository,
    MemberWriteRepository,
    RolesGuard,
  ],
  exports: [ProjectService],
})
export class ProjectModule {}
