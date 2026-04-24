import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { RolesGuard } from '../common/guard/roles.guard';
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
  imports: [TypeOrmModule.forFeature([Cohort, CohortPart]), AuditModule],
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
