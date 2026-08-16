import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export const createTypeOrmModuleOptions = (config: ConfigService): TypeOrmModuleOptions => {
  // synchronize 는 부팅할 때마다 엔티티 정의에 맞춰 DDL 을 자동 실행한다.
  // 운영에서는 DB_SYNCHRONIZE=false 로 꺼야 하지만, 마이그레이션이 아직 없으므로
  // 기본값은 기존 동작(true) 을 유지한다. 마이그레이션 도입 후 운영 환경변수만 바꾸면 된다.
  const synchronize = config.get<string>('DB_SYNCHRONIZE') !== 'false';

  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    autoLoadEntities: true,
    synchronize,
    migrationsRun: false,
  };
};

// NOTE :: CLI/마이그레이션 컨텍스트는 NestJS DI 밖에서 실행되므로 process.env 직접 접근을 허용한다.
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
