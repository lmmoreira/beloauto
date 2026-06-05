import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { IStorageService, GenerateSignedUrlResult } from '../ports/storage.service.port';

const SIGNED_URL_TTL_MS = 15 * 60 * 1000;

@Injectable()
export class GcsSignedUrlService implements IStorageService, OnApplicationBootstrap {
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly emulatorHost: string | undefined;
  private readonly maxUploadBytes: number;

  constructor(config: ConfigService) {
    this.emulatorHost = config.get<string>('GCS_EMULATOR_HOST');
    this.bucketName = config.get<string>('GCS_BUCKET_NAME') ?? 'beloauto-local';
    this.maxUploadBytes = config.get<number>('GCS_MAX_UPLOAD_BYTES') ?? 10_485_760;

    const storageOptions: Record<string, unknown> = {};
    if (this.emulatorHost) {
      storageOptions['apiEndpoint'] = this.emulatorHost;
      storageOptions['projectId'] = 'beloauto-local';
    }
    const keyFile = config.get<string>('GCS_KEY_FILE');
    if (keyFile) {
      storageOptions['keyFilename'] = keyFile;
    }

    this.storage = new Storage(storageOptions);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.emulatorHost) return;
    const bucket = this.storage.bucket(this.bucketName);
    const [exists] = await bucket.exists();
    if (!exists) {
      await this.storage.createBucket(this.bucketName);
    }
  }

  async generateSignedUrl(
    storagePath: string,
    contentType: string,
    _operation: 'write',
  ): Promise<GenerateSignedUrlResult> {
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_MS);
    const file = this.storage.bucket(this.bucketName).file(storagePath);

    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: expiresAt,
      contentType,
      // content-length-range is embedded as a required extension header.
      // The client must include x-goog-content-length-range in the PUT request;
      // GCS enforces the upper bound against Content-Length in production.
      extensionHeaders: {
        'x-goog-content-length-range': `0,${this.maxUploadBytes}`,
      },
    });

    return { signedUrl, expiresAt };
  }
}
