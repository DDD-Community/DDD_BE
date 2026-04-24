import { Module } from '@nestjs/common';

import { RolesGuard } from '../common/guard/roles.guard';
import { StorageService } from './application/storage.service';
import { GcsClient } from './infrastructure/gcs.client';
import { AdminStorageController } from './interface/admin.storage.controller';

@Module({
  controllers: [AdminStorageController],
  providers: [StorageService, GcsClient, RolesGuard],
  exports: [StorageService],
})
export class StorageModule {}
