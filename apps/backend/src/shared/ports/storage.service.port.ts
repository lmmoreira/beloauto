export const STORAGE_SERVICE = Symbol('IStorageService');

export interface GenerateSignedUrlResult {
  signedUrl: string;
  expiresAt: Date;
}

export interface IStorageService {
  generateSignedUrl(
    storagePath: string,
    contentType: string,
    operation: 'write',
  ): Promise<GenerateSignedUrlResult>;
}
