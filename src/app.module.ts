import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validate } from './config/env.validation';
import { createTypeOrmModuleOptions } from './config/typeorm.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: createTypeOrmModuleOptions,
      inject: [ConfigService],
    }),
    HealthModule,
  ],
})
export class AppModule {}
