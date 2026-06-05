import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import { GcsSignedUrlService } from './gcs-signed-url.service';

jest.mock('@google-cloud/storage');

const MockStorage = Storage as jest.MockedClass<typeof Storage>;

describe('GcsSignedUrlService', () => {
  let mockGetSignedUrl: jest.Mock;
  let mockBucketExists: jest.Mock;
  let mockCreateBucket: jest.Mock;
  let mockFile: jest.Mock;
  let mockBucket: jest.Mock;

  function makeConfig(overrides: Record<string, string | undefined> = {}): ConfigService {
    return {
      get: jest.fn((key: string) => overrides[key]),
    } as unknown as ConfigService;
  }

  function makeService(configValues: Record<string, string | undefined> = {}): GcsSignedUrlService {
    return new GcsSignedUrlService(makeConfig(configValues));
  }

  beforeEach(() => {
    mockGetSignedUrl = jest
      .fn()
      .mockResolvedValue(['https://storage.googleapis.com/bucket/path?X-Goog-Signature=abc']);
    mockFile = jest.fn().mockReturnValue({ getSignedUrl: mockGetSignedUrl });
    mockBucketExists = jest.fn().mockResolvedValue([true]);
    mockCreateBucket = jest.fn().mockResolvedValue(undefined);
    mockBucket = jest.fn().mockReturnValue({ exists: mockBucketExists, file: mockFile });

    MockStorage.mockImplementation(
      () =>
        ({
          bucket: mockBucket,
          createBucket: mockCreateBucket,
        }) as unknown as Storage,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('configures emulator endpoint and projectId when GCS_EMULATOR_HOST is set', () => {
      makeService({ GCS_EMULATOR_HOST: 'http://localhost:4443' });
      expect(MockStorage).toHaveBeenCalledWith(
        expect.objectContaining({
          apiEndpoint: 'http://localhost:4443',
          projectId: 'beloauto-local',
        }),
      );
    });

    it('sets keyFilename when GCS_KEY_FILE is set', () => {
      makeService({ GCS_KEY_FILE: '/path/to/key.json' });
      expect(MockStorage).toHaveBeenCalledWith(
        expect.objectContaining({ keyFilename: '/path/to/key.json' }),
      );
    });

    it('uses empty storage options when neither emulator nor key file is configured', () => {
      makeService({});
      expect(MockStorage).toHaveBeenCalledWith({});
    });
  });

  describe('onApplicationBootstrap()', () => {
    it('returns early without accessing GCS when no emulator host is configured', async () => {
      const service = makeService({});
      await service.onApplicationBootstrap();
      expect(mockBucket).not.toHaveBeenCalled();
    });

    it('creates bucket when emulator is set and bucket does not exist', async () => {
      mockBucketExists.mockResolvedValue([false]);
      const service = makeService({ GCS_EMULATOR_HOST: 'http://localhost:4443' });
      await service.onApplicationBootstrap();
      expect(mockCreateBucket).toHaveBeenCalledWith('beloauto-local');
    });

    it('does not create bucket when emulator is set and bucket already exists', async () => {
      mockBucketExists.mockResolvedValue([true]);
      const service = makeService({ GCS_EMULATOR_HOST: 'http://localhost:4443' });
      await service.onApplicationBootstrap();
      expect(mockCreateBucket).not.toHaveBeenCalled();
    });
  });

  describe('generateSignedUrl()', () => {
    it('returns the signedUrl and an expiresAt Date', async () => {
      const service = makeService({});
      const result = await service.generateSignedUrl(
        'tenants/t1/uploads/uuid/car.jpg',
        'image/jpeg',
        'write',
      );
      expect(result.signedUrl).toBe(
        'https://storage.googleapis.com/bucket/path?X-Goog-Signature=abc',
      );
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('calls getSignedUrl with v4, write action and correct contentType', async () => {
      const service = makeService({});
      await service.generateSignedUrl('tenants/t1/uploads/uuid/car.jpg', 'image/png', 'write');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({ version: 'v4', action: 'write', contentType: 'image/png' }),
      );
    });

    it('passes the correct file path to the storage bucket', async () => {
      const service = makeService({});
      const path = 'tenants/abc/bookings/def/photo.jpg';
      await service.generateSignedUrl(path, 'image/jpeg', 'write');
      expect(mockFile).toHaveBeenCalledWith(path);
    });

    it('uses custom bucket name from config', async () => {
      const service = makeService({ GCS_BUCKET_NAME: 'my-prod-bucket' });
      await service.generateSignedUrl('path/file.jpg', 'image/jpeg', 'write');
      expect(mockBucket).toHaveBeenCalledWith('my-prod-bucket');
    });

    it('defaults to beloauto-local bucket when GCS_BUCKET_NAME is not set', async () => {
      const service = makeService({});
      await service.generateSignedUrl('path/file.jpg', 'image/jpeg', 'write');
      expect(mockBucket).toHaveBeenCalledWith('beloauto-local');
    });

    it('sets expiresAt approximately 15 minutes in the future', async () => {
      const before = Date.now();
      const service = makeService({});
      const result = await service.generateSignedUrl('path/file.jpg', 'image/jpeg', 'write');
      const after = Date.now();
      const expiresMs = result.expiresAt.getTime();
      const ttlMs = 15 * 60 * 1000;
      expect(expiresMs).toBeGreaterThanOrEqual(before + ttlMs - 100);
      expect(expiresMs).toBeLessThanOrEqual(after + ttlMs + 100);
    });
  });
});
