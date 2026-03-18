import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export const createTypeOrmModuleOptions = (config: ConfigService): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: config.getOrThrow<string>('DB_HOST'),
  port: config.getOrThrow<number>('DB_PORT'),
  username: config.getOrThrow<string>('DB_USERNAME'),
  password: config.getOrThrow<string>('DB_PASSWORD'),
  database: config.getOrThrow<string>('DB_NAME'),
  autoLoadEntities: true,
  synchronize: false,
  migrationsRun: false,
});

// CLI/마이그레이션 컨텍스트는 NestJS DI 밖에서 실행되므로 process.env 직접 접근을 허용한다.
export const createTypeOrmDataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  entities: ['src/**/*.entity.ts', 'dist/**/*.entity.js'],
  migrations: ['src/config/migrations/*.ts', 'dist/config/migrations/*.js'],
  synchronize: false,
  migrationsRun: false,
});
