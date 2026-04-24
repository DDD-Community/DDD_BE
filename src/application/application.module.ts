import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { InterviewModule } from '../interview/interview.module';
import { NotificationModule } from '../notification/notification.module';
import { ApplicationRepository } from './domain/application.repository';
import { ApplicationDraft } from './domain/application-draft.entity';
import { ApplicationForm } from './domain/application-form.entity';
import { DraftWriteRepository } from './infrastructure/draft.write.repository';
import { EmailEventHandler } from './infrastructure/email-event.handler';
import { FormWriteRepository } from './infrastructure/form.write.repository';
import { PiiPurgeScheduler } from './infrastructure/pii-purge.scheduler';
import { AdminApplicationController } from './interface/admin.application.controller';
import { PublicApplicationController } from './interface/public.application.controller';
import { ApplicationService } from './usecase/application.service';
import { ApplicationAnswerValidator } from './usecase/application-answer.validator';
import { ApplicationQueryService } from './usecase/application-query.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationForm, ApplicationDraft]),
    CohortModule,
    NotificationModule,
    forwardRef(() => InterviewModule),
  ],
  controllers: [AdminApplicationController, PublicApplicationController],
  providers: [
    ApplicationAnswerValidator,
    ApplicationQueryService,
    ApplicationService,
    ApplicationRepository,
    FormWriteRepository,
    DraftWriteRepository,
    EmailEventHandler,
    PiiPurgeScheduler,
    RolesGuard,
  ],
  exports: [ApplicationService],
})
export class ApplicationModule {}
