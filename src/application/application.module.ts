import { forwardRef, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { CohortModule } from '../cohort/cohort.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { InterviewModule } from '../interview/interview.module';
import { NotificationModule } from '../notification/notification.module';
import { StorageModule } from '../storage/storage.module';
import { UserModule } from '../user/user.module';
import { ApplicationRepository } from './domain/application.repository';
import { ApplicationDraft } from './domain/application-draft.entity';
import { ApplicationEmailVerification } from './domain/application-email-verification.entity';
import { ApplicationEmailVerificationRepository } from './domain/application-email-verification.repository';
import { ApplicationForm } from './domain/application-form.entity';
import { ApplicationEmailVerificationWriteRepository } from './infrastructure/application-email-verification.write.repository';
import { DraftWriteRepository } from './infrastructure/draft.write.repository';
import { EmailEventHandler } from './infrastructure/email-event.handler';
import { FormWriteRepository } from './infrastructure/form.write.repository';
import { PiiPurgeScheduler } from './infrastructure/pii-purge.scheduler';
import { AdminApplicationController } from './interface/admin.application.controller';
import { PublicApplicationController } from './interface/public.application.controller';
import { PublicApplicationVerificationController } from './interface/public.application-verification.controller';
import { ApplicationService } from './usecase/application.service';
import { ApplicationAnswerValidator } from './usecase/application-answer.validator';
import { ApplicationAttachmentService } from './usecase/application-attachment.service';
import { ApplicationQueryService } from './usecase/application-query.service';
import { ApplicationVerificationService } from './usecase/application-verification.service';
import { PiiPurgeService } from './usecase/pii-purge.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApplicationForm, ApplicationDraft, ApplicationEmailVerification]),
    ThrottlerModule.forRoot([{ ttl: 10 * 60 * 1000, limit: 5 }]),
    AuthModule,
    UserModule,
    CohortModule,
    NotificationModule,
    StorageModule,
    forwardRef(() => InterviewModule),
  ],
  controllers: [
    AdminApplicationController,
    PublicApplicationController,
    PublicApplicationVerificationController,
  ],
  providers: [
    ApplicationAnswerValidator,
    ApplicationAttachmentService,
    ApplicationQueryService,
    ApplicationService,
    ApplicationRepository,
    FormWriteRepository,
    DraftWriteRepository,
    ApplicationEmailVerificationWriteRepository,
    {
      provide: ApplicationEmailVerificationRepository,
      useExisting: ApplicationEmailVerificationWriteRepository,
    },
    ApplicationVerificationService,
    EmailEventHandler,
    PiiPurgeService,
    PiiPurgeScheduler,
    RolesGuard,
  ],
  exports: [ApplicationService],
})
export class ApplicationModule {}
