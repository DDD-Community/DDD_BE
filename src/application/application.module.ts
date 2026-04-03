import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortModule } from '../cohort/cohort.module';
import { ApplicationService } from './application/application.service';
import { ApplicationRepository } from './domain/application.repository';
import { ApplicationDraft } from './domain/application-draft.entity';
import { ApplicationForm } from './domain/application-form.entity';
import { EmailEventHandler } from './infrastructure/email-event.handler';
import { WriteRepository } from './infrastructure/write.repository';
import { AdminApplicationController } from './interface/admin.application.controller';
import { PublicApplicationController } from './interface/public.application.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ApplicationForm, ApplicationDraft]), CohortModule],
  controllers: [AdminApplicationController, PublicApplicationController],
  providers: [ApplicationService, ApplicationRepository, WriteRepository, EmailEventHandler],
  exports: [ApplicationService],
})
export class ApplicationModule {}
