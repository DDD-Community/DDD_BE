import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortService } from './application/cohort.service';
import { Cohort } from './domain/cohort.entity';
import { CohortRepository } from './domain/cohort.repository';
import { WriteRepository } from './infrastructure/write.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Cohort])],
  providers: [CohortService, CohortRepository, WriteRepository],
  exports: [CohortService],
})
export class CohortModule {}
