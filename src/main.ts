import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from './app.module';
import { ALLOWED_ORIGINS } from './config/cors.config';
import { setupSwagger } from './config/swagger.config';

// express.json() 기본값은 100kb 라 우리가 정한 값이 아니었다. 지원서 answers 는 자유 형식이고
// 길이 상한도 없어서 장문 문항이 여러 개면 도달할 수 있다. 넘으면 413 과 한국어 안내가 나간다.
const JSON_BODY_LIMIT = '1mb';

const bootstrap = async () => {
  initializeTransactionalContext();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(cookieParser());

  app.enableCors({
    origin: [...ALLOWED_ORIGINS],
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  const configService = app.get(ConfigService);

  setupSwagger(app);

  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);

  const appUrl = await app.getUrl();
  Logger.log(`Server is running on ${appUrl}`, 'Bootstrap');
};

void bootstrap();
