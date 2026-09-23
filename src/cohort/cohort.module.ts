import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from '../application/application.module';
import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { ProjectModule } from '../project/project.module';
import { CohortService } from './application/cohort.service';
import { Cohort } from './domain/cohort.entity';
import { CohortRepository } from './domain/cohort.repository';
import { CohortPart } from './domain/cohort-part.entity';
import { CohortScheduler } from './infrastructure/cohort.scheduler';
import { PartWriteRepository } from './infrastructure/part.write.repository';
import { WriteRepository } from './infrastructure/write.repository';
import { AdminCohortController } from './interface/admin.cohort.controller';
import { PublicCohortController } from './interface/public.cohort.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cohort, CohortPart]),
    AuditModule,
    forwardRef(() => NotificationModule),
    forwardRef(() => ApplicationModule),
    // 기수를 지우기 전에 붙어 있는 프로젝트가 있는지 확인한다.
    // 프로젝트 쪽도 기수 재배정 때 이 모듈을 보므로 서로를 참조한다.
    forwardRef(() => ProjectModule),
  ],
  controllers: [AdminCohortController, PublicCohortController],
  providers: [
    CohortService,
    CohortRepository,
    WriteRepository,
    PartWriteRepository,
    CohortScheduler,
    RolesGuard,
  ],
  exports: [CohortService, CohortRepository],
})
export class CohortModule {}
