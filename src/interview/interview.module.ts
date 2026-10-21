import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from '../application/application.module';
import { KoreanThrottlerGuard } from '../common/guard/korean-throttler.guard';
import { RolesGuard } from '../common/guard/roles.guard';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { InterviewService } from './application/interview.service';
import { InterviewBookingTokenService } from './application/interview-booking-token.service';
import { InterviewJoinService } from './application/interview-join.service';
import { InterviewJoinTokenService } from './application/interview-join-token.service';
import { InterviewMeetingService } from './application/interview-meeting.service';
import { InterviewRepository } from './domain/interview.repository';
import { InterviewReservation } from './domain/interview-reservation.entity';
import { InterviewSlot } from './domain/interview-slot.entity';
import { InterviewSlotInterviewer } from './domain/interview-slot-interviewer.entity';
import { GoogleCalendarClient } from './infrastructure/google-calendar.client';
import { InterviewMeetingScheduler } from './infrastructure/interview-meeting.scheduler';
import { InterviewerWriteRepository } from './infrastructure/interviewer.write.repository';
import { ReservationWriteRepository } from './infrastructure/reservation.write.repository';
import { SlotWriteRepository } from './infrastructure/slot.write.repository';
import { AdminInterviewController } from './interface/admin.interview.controller';
import { InterviewBookingGuard } from './interface/interview-booking.guard';
import { PublicInterviewBookingController } from './interface/public.interview-booking.controller';
import { PublicInterviewJoinController } from './interface/public.interview-join.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InterviewSlot, InterviewReservation, InterviewSlotInterviewer]),
    forwardRef(() => ApplicationModule),
    NotificationModule,
    GoogleCalendarModule,
    UserModule,
    ThrottlerModule.forRoot([{ ttl: 60 * 1000, limit: 30 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [
    AdminInterviewController,
    PublicInterviewBookingController,
    PublicInterviewJoinController,
  ],
  providers: [
    InterviewService,
    InterviewMeetingService,
    InterviewMeetingScheduler,
    InterviewRepository,
    SlotWriteRepository,
    InterviewerWriteRepository,
    ReservationWriteRepository,
    GoogleCalendarClient,
    RolesGuard,
    KoreanThrottlerGuard,
    InterviewBookingTokenService,
    InterviewJoinTokenService,
    InterviewJoinService,
    InterviewBookingGuard,
  ],
  exports: [InterviewService, InterviewBookingTokenService],
})
export class InterviewModule {}
