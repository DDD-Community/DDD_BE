import { forwardRef, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ApplicationModule } from '../application/application.module';
import { RolesGuard } from '../common/guard/roles.guard';
import { NotificationModule } from '../notification/notification.module';
import { InterviewService } from './application/interview.service';
import { InterviewBookingTokenService } from './application/interview-booking-token.service';
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
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminInterviewController],
  providers: [
    InterviewService,
    InterviewRepository,
    SlotWriteRepository,
    ReservationWriteRepository,
    GoogleCalendarClient,
    RolesGuard,
    InterviewBookingTokenService,
  ],
  exports: [InterviewService, InterviewBookingTokenService],
})
export class InterviewModule {}
