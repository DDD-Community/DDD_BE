import { existsSync } from 'node:fs';

import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

import { createTypeOrmDataSourceOptions } from './typeorm.config';

const envFiles = [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'];

for (const envFile of envFiles) {
  if (existsSync(envFile)) {
    loadEnv({ path: envFile, override: false });
  }
}

export default new DataSource(createTypeOrmDataSourceOptions());
