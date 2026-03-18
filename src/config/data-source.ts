import 'dotenv/config';

import { DataSource } from 'typeorm';

import { createTypeOrmDataSourceOptions } from './typeorm.config';

export default new DataSource(createTypeOrmDataSourceOptions());
