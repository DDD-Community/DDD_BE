import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

const bootstrap = async (): Promise<void> => {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);

  const appUrl = await app.getUrl();
  Logger.log(`Server is running on ${appUrl}`, 'Bootstrap');
};

void bootstrap();
