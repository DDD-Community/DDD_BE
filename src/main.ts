import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { initializeTransactionalContext } from 'typeorm-transactional';

import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger.config';

const bootstrap = async (): Promise<void> => {
  initializeTransactionalContext();

  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI });

  if (process.env.NODE_ENV !== 'production') {
    setupSwagger(app);
  }

  const configService = app.get(ConfigService);
  const port = configService.getOrThrow<number>('PORT');

  await app.listen(port);

  const appUrl = await app.getUrl();
  Logger.log(`Server is running on ${appUrl}`, 'Bootstrap');
};

void bootstrap();
