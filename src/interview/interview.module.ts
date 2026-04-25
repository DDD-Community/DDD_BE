import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from '../application/application.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { InterviewService } from './application/interview.service';
import { InterviewRepository } from './domain/interview.repository';
import { InterviewReservation } from './domain/interview-reservation.entity';
import { InterviewSlot } from './domain/interview-slot.entity';
import { GoogleCalendarClient } from './infrastructure/google-calendar.client';
import { ReservationWriteRepository } from './infrastructure/reservation.write.repository';
import { SlotWriteRepository } from './infrastructure/slot.write.repository';
import { AdminInterviewController } from './interface/admin.interview.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewSlot, InterviewReservation]),
    forwardRef(() => ApplicationModule),
    NotificationModule,
  ],
  controllers: [AdminInterviewController],
  providers: [
    InterviewService,
    InterviewRepository,
    SlotWriteRepository,
    ReservationWriteRepository,
    GoogleCalendarClient,
    RolesGuard,
  ],
  exports: [InterviewService],
})
export class InterviewModule {}
