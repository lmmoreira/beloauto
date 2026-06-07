import { InMemoryStorageService } from '../../../../test/infrastructure/in-memory-storage.service';
import { BookingPhotoNotUploadedError } from '../../domain/errors/booking-domain.error';
import { PhotoExistenceService } from './photo-existence.service';

describe('PhotoExistenceService', () => {
  let storageService: InMemoryStorageService;
  let service: PhotoExistenceService;

  beforeEach(() => {
    storageService = new InMemoryStorageService();
    service = new PhotoExistenceService(storageService);
  });

  it('resolves when the list is empty', async () => {
    await expect(service.assertPhotosUploaded([])).resolves.toBeUndefined();
  });

  it('resolves when every photo path exists in storage', async () => {
    storageService.markAsUploaded('tenants/t1/uploads/u1/photo1.jpg');
    storageService.markAsUploaded('tenants/t1/uploads/u2/photo2.jpg');

    await expect(
      service.assertPhotosUploaded([
        'tenants/t1/uploads/u1/photo1.jpg',
        'tenants/t1/uploads/u2/photo2.jpg',
      ]),
    ).resolves.toBeUndefined();
  });

  it('throws BookingPhotoNotUploadedError for the first missing photo path', async () => {
    storageService.markAsUploaded('tenants/t1/uploads/u1/photo1.jpg');

    await expect(
      service.assertPhotosUploaded([
        'tenants/t1/uploads/u1/photo1.jpg',
        'tenants/t1/uploads/u2/missing.jpg',
      ]),
    ).rejects.toThrow(BookingPhotoNotUploadedError);
  });

  it('includes the missing storage path in the error message', async () => {
    await expect(
      service.assertPhotosUploaded(['tenants/t1/uploads/u1/missing.jpg']),
    ).rejects.toThrow('tenants/t1/uploads/u1/missing.jpg');
  });
});
