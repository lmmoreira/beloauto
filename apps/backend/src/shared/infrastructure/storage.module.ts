import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from '../ports/storage.service.port';
import { GcsSignedUrlAdapter } from './gcs-signed-url.adapter';

@Module({
  providers: [GcsSignedUrlAdapter, { provide: STORAGE_SERVICE, useExisting: GcsSignedUrlAdapter }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
