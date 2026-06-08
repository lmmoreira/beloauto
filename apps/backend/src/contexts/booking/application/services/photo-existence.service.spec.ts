import { InMemoryStorageService } from '../../../../test/infrastructure/in-memory-storage.service';
import { BookingPhotoNotUploadedError } from '../../domain/errors/booking-domain.error';
import { PhotoExistenceService } from './photo-existence.service';

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

describe('PhotoExistenceService', () => {
  let storageService: InMemoryStorageService;
  let service: PhotoExistenceService;

  beforeEach(() => {
    storageService = new InMemoryStorageService();
    service = new PhotoExistenceService(storageService);
  });

  it('resolves when the list is empty', async () => {
    await expect(service.assertPhotosUploaded([], TENANT_A)).resolves.toBeUndefined();
  });

  it('resolves when every photo path exists in storage and belongs to the tenant', async () => {
    storageService.markAsUploaded('tenants/tenant-a/uploads/u1/photo1.jpg');
    storageService.markAsUploaded('tenants/tenant-a/uploads/u2/photo2.jpg');

    await expect(
      service.assertPhotosUploaded(
        ['tenants/tenant-a/uploads/u1/photo1.jpg', 'tenants/tenant-a/uploads/u2/photo2.jpg'],
        TENANT_A,
      ),
    ).resolves.toBeUndefined();
  });

  it('throws BookingPhotoNotUploadedError for the first missing photo path', async () => {
    storageService.markAsUploaded('tenants/tenant-a/uploads/u1/photo1.jpg');

    await expect(
      service.assertPhotosUploaded(
        ['tenants/tenant-a/uploads/u1/photo1.jpg', 'tenants/tenant-a/uploads/u2/missing.jpg'],
        TENANT_A,
      ),
    ).rejects.toThrow(BookingPhotoNotUploadedError);
  });

  it('includes the missing storage path in the error message', async () => {
    await expect(
      service.assertPhotosUploaded(['tenants/tenant-a/uploads/u1/missing.jpg'], TENANT_A),
    ).rejects.toThrow('tenants/tenant-a/uploads/u1/missing.jpg');
  });

  it('tenant isolation: rejects a path that exists but belongs to another tenant', async () => {
    const otherTenantPath = `tenants/${TENANT_B}/uploads/u1/photo1.jpg`;
    storageService.markAsUploaded(otherTenantPath);

    await expect(service.assertPhotosUploaded([otherTenantPath], TENANT_A)).rejects.toBeInstanceOf(
      BookingPhotoNotUploadedError,
    );
  });

  it('tenant isolation: rejects a path with no tenant prefix at all', async () => {
    storageService.markAsUploaded('uploads/u1/photo1.jpg');

    await expect(
      service.assertPhotosUploaded(['uploads/u1/photo1.jpg'], TENANT_A),
    ).rejects.toBeInstanceOf(BookingPhotoNotUploadedError);
  });
});
