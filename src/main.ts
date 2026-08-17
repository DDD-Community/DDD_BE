import { BadRequestException, Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from './app.module';
import { toKoreanValidationMessages } from './common/error/validation-message';
import { JSON_BODY_LIMIT } from './config/body-parser.config';
import { ALLOWED_ORIGINS } from './config/cors.config';
import { setupSwagger } from './config/swagger.config';

const bootstrap = async () => {
  initializeTransactionalContext();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // listen() 전에 불러야 Nest 가 등록하는 기본 파서를 선점한다. cookieParser 와의 순서는 무관하다.
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(cookieParser());

  app.enableCors({
    origin: [...ALLOWED_ORIGINS],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // 기본 문구는 'applicantName should not be empty' 같은 영문이라 지원자에게 그대로 나간다.
      exceptionFactory: (errors) => new BadRequestException(toKoreanValidationMessages(errors)),
    }),
  );
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
