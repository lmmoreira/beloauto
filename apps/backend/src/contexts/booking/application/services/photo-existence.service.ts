import { Inject, Injectable } from '@nestjs/common';
import { IStorageService, STORAGE_SERVICE } from '../../../../shared/ports/storage.service.port';
import { BookingPhotoNotUploadedError } from '../../domain/errors/booking-domain.error';

@Injectable()
export class PhotoExistenceService {
  constructor(@Inject(STORAGE_SERVICE) private readonly storageService: IStorageService) {}

  async assertPhotosUploaded(photoUrls: string[]): Promise<void> {
    for (const photoUrl of photoUrls) {
      const exists = await this.storageService.exists(photoUrl);
      if (!exists) throw new BookingPhotoNotUploadedError(photoUrl);
    }
  }
}
