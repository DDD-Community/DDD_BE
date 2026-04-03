import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortService } from './application/cohort.service';
import { Cohort } from './domain/cohort.entity';
import { CohortRepository } from './domain/cohort.repository';
import { CohortPart } from './domain/cohort-part.entity';
import { CohortScheduler } from './infrastructure/cohort.scheduler';
import { WriteRepository } from './infrastructure/write.repository';
import { AdminCohortController } from './interface/admin.cohort.controller';
import { PublicCohortController } from './interface/public.cohort.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cohort, CohortPart])],
  controllers: [AdminCohortController, PublicCohortController],
  providers: [CohortService, CohortRepository, WriteRepository, CohortScheduler],
  exports: [CohortService],
})
export class CohortModule {}
