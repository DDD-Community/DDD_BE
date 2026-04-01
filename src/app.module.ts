import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { InjectDataSource, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { addTransactionalDataSource } from 'typeorm-transactional';

import { CohortModule } from './cohort/cohort.module';
import { HttpExceptionFilter } from './common/exception/http-exception.filter';
import { validate } from './config/env.validation';
import { createTypeOrmModuleOptions } from './config/typeorm.config';
import { GoogleModule } from './google/google.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createTypeOrmModuleOptions,
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    HealthModule,
    GoogleModule,
    CohortModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  onModuleInit(): void {
    addTransactionalDataSource(this.dataSource);
  }
}
