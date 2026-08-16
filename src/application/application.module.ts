import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { InterviewModule } from '../interview/interview.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../storage/storage.module';
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
import { ApplicationAttachmentService } from './usecase/application-attachment.service';
import { ApplicationQueryService } from './usecase/application-query.service';
import { PiiPurgeService } from './usecase/pii-purge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationForm, ApplicationDraft]),
    CohortModule,
    NotificationModule,
    StorageModule,
    forwardRef(() => InterviewModule),
  ],
  controllers: [AdminApplicationController, PublicApplicationController],
  providers: [
    ApplicationAnswerValidator,
    ApplicationAttachmentService,
    ApplicationQueryService,
    ApplicationService,
    ApplicationRepository,
    FormWriteRepository,
    DraftWriteRepository,
    EmailEventHandler,
    PiiPurgeService,
    PiiPurgeScheduler,
    RolesGuard,
  ],
  exports: [ApplicationService],
})
export class ApplicationModule {}
