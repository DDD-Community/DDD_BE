import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { validate } from './config/env.validation';
import { createTypeOrmModuleOptions } from './config/typeorm.config';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Prefer env-specific files and keep .env as a fallback for compatibility.
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
    HealthModule,
  ],
})
export class AppModule {}
