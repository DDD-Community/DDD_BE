import { Logger, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({ type: VersioningType.URI });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') ?? 3000;

  await app.listen(port);

  const appUrl = await app.getUrl();
  Logger.log(`Server is running on ${appUrl}`, 'Bootstrap');
};

void bootstrap();
