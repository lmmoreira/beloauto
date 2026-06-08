import { GenerateSignedUrlResult, IStorageService } from '../../shared/ports/storage.service.port';

export class InMemoryStorageService implements IStorageService {
  readonly uploadedPaths: string[] = [];
  private readonly existingPaths = new Set<string>();

  async generateSignedUrl(
    storagePath: string,
    contentType: string,
  ): Promise<GenerateSignedUrlResult> {
    this.uploadedPaths.push(storagePath);
    return {
      signedUrl: `http://fake-gcs/bucket/${storagePath}?sig=test&contentType=${encodeURIComponent(contentType)}`,
      expiresAt: new Date('2099-01-01T00:00:00Z'),
    };
  }

  async exists(storagePath: string): Promise<boolean> {
    return this.existingPaths.has(storagePath);
  }

  markAsUploaded(storagePath: string): void {
    this.existingPaths.add(storagePath);
  }
}
