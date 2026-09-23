import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { StorageModule } from '../storage/storage.module';
import { ProjectService } from './application/project.service';
import { ProjectAssetService } from './application/project-asset.service';
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
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember]),
    StorageModule,
    // 기수 재배정 때 살아 있는 기수인지 확인한다. 기수 삭제 가드가 반대 방향으로 물려 있어 순환이다.
    forwardRef(() => CohortModule),
  ],
  controllers: [AdminProjectController, PublicProjectController],
  providers: [
    ProjectService,
    ProjectAssetService,
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
