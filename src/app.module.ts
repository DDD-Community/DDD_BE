import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

import { ApplicationModule } from './application/application.module';
import { BlogModule } from './blog/blog.module';
import { CohortModule } from './cohort/cohort.module';
import { HttpExceptionFilter } from './common/exception/http-exception.filter';
import { EncryptionTransformer } from './common/util/encryption.transformer';
import { validate } from './config/env.validation';
import { createTypeOrmModuleOptions } from './config/typeorm.config';
import { GoogleModule } from './google/google.module';
import { HealthModule } from './health/health.module';
import { NotificationModule } from './notification/notification.module';
import { ProjectModule } from './project/project.module';

const ENV_FILE_PATHS = ['.env.production', '.env.staging', '.env.test', '.env.development', '.env'];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ENV_FILE_PATHS,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createTypeOrmModuleOptions,
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    HealthModule,
    GoogleModule,
    CohortModule,
    ApplicationModule,
    BlogModule,
    NotificationModule,
    ProjectModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule implements OnModuleInit {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    configService: ConfigService,
  ) {
    const encryptionKey = configService.getOrThrow<string>('ENCRYPTION_KEY');

    EncryptionTransformer.configure({ encryptionKey });
  }

  onModuleInit(): void {
    addTransactionalDataSource(this.dataSource);
  }
}
