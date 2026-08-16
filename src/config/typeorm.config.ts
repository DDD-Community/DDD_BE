import { join } from 'node:path';

import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';

export const createTypeOrmModuleOptions = (config: ConfigService): TypeOrmModuleOptions => {
  // synchronize 는 부팅할 때마다 엔티티 정의에 맞춰 DDL 을 자동 실행한다.
  // 운영(DB_SYNCHRONIZE=false)에서는 스키마 변경 경로가 마이그레이션 하나뿐이 된다.
  const synchronize = config.get<string>('DB_SYNCHRONIZE') !== 'false';

  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    autoLoadEntities: true,
    // 경로를 문자열로 박으면 안 된다. 빌드 산출물 위치가 워크스페이스 구성에 따라
    // dist/ 와 dist/src/ 로 갈리기 때문이다(루트에 src 밖 .ts 가 있으면 tsc 가 rootDir 을 넓힌다).
    // __dirname 기준이면 개발(src/config)과 운영(dist/config) 양쪽에서 항상 맞는다.
    migrations: [join(__dirname, 'migrations', '*{.ts,.js}')],
    synchronize,
    // synchronize 와 함께 켜서는 안 된다. TypeORM 은 synchronize 를 먼저 끝낸 뒤
    // 마이그레이션을 돌리므로, 둘 다 켜면 이미 만들어진 스키마에 베이스라인의
    // CREATE TABLE 이 실행돼 앱이 부팅하지 못한다.
    // 반대로 이 값을 빠뜨리면 synchronize 를 끈 채 마이그레이션도 돌지 않아
    // 스키마 변경이 조용히 유실된다 - 자동 DDL 을 끄는 것보다 위험한 상태다.
    migrationsRun: !synchronize,
  };
};

// NOTE :: CLI/마이그레이션 컨텍스트는 NestJS DI 밖에서 실행되므로 process.env 직접 접근을 허용한다.
// 이 DataSource 는 typeorm-ts-node-commonjs 로만 실행되므로 글롭은 .ts 만 본다.
// dist 글롭을 함께 두면 빌드 산출물이 있는 워크스페이스에서 같은 엔티티가 두 번 등록돼
// migration:generate 가 엉뚱한 스키마를 만든다. 런타임 경로는 아래 모듈 옵션이 따로 담당한다.
export const createTypeOrmDataSourceOptions = (): DataSourceOptions => ({
  type: 'postgres',
  host: process.env.DB_HOST!,
  port: Number(process.env.DB_PORT!),
  username: process.env.DB_USERNAME!,
  password: process.env.DB_PASSWORD!,
  database: process.env.DB_NAME!,
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/config/migrations/*.ts'],
  synchronize: false,
  migrationsRun: false,
});
