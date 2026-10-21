import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';

import { RolesGuard } from '../common/guard/roles.guard';
import { UserModule } from '../user/user.module';
import { GoogleCalendarConnectionService } from './application/google-calendar-connection.service';
import { GoogleCalendarConnection } from './domain/google-calendar-connection.entity';
import { GoogleCalendarConnectionRepository } from './domain/google-calendar-connection.repository';
import { GoogleCalendarConnectionWriteRepository } from './infrastructure/google-calendar-connection.write.repository';
import { GoogleOAuthCalendarClient } from './infrastructure/google-oauth-calendar.client';
import { AdminGoogleCalendarController } from './interface/admin.google-calendar.controller';
import { GoogleCalendarCallbackRedirectFilter } from './interface/google-calendar-callback-redirect.filter';

@Module({
  imports: [
    // 앱은 autoLoadEntities 라 모듈이 forFeature 로 등록한 엔티티만 메타데이터에 올린다.
    // 저장소가 DataSource 를 직접 쓰더라도 이 등록이 없으면 EntityMetadataNotFoundError 가 난다.
    TypeOrmModule.forFeature([GoogleCalendarConnection]),
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
