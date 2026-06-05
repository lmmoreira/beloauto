import { Module } from '@nestjs/common';
import { STORAGE_SERVICE } from '../ports/storage.service.port';
import { GcsSignedUrlService } from './gcs-signed-url.service';

@Module({
  providers: [GcsSignedUrlService, { provide: STORAGE_SERVICE, useExisting: GcsSignedUrlService }],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
