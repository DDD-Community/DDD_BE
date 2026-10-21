import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { RolesGuard } from '../common/guard/roles.guard';
import { UserModule } from '../user/user.module';
import { GoogleCalendarConnectionService } from './application/google-calendar-connection.service';
import { GoogleCalendarConnectionRepository } from './domain/google-calendar-connection.repository';
import { GoogleCalendarConnectionWriteRepository } from './infrastructure/google-calendar-connection.write.repository';
import { GoogleOAuthCalendarClient } from './infrastructure/google-oauth-calendar.client';
import { AdminGoogleCalendarController } from './interface/admin.google-calendar.controller';
import { GoogleCalendarCallbackRedirectFilter } from './interface/google-calendar-callback-redirect.filter';

@Module({
  imports: [
    UserModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AdminGoogleCalendarController],
  providers: [
    GoogleCalendarConnectionService,
    GoogleCalendarConnectionRepository,
    GoogleCalendarConnectionWriteRepository,
    GoogleOAuthCalendarClient,
    RolesGuard,
    GoogleCalendarCallbackRedirectFilter,
  ],
  exports: [GoogleCalendarConnectionService],
})
export class GoogleCalendarModule {}
