import type { Address } from './address';
import type { MoneyAmount } from './money';

export interface CreateBookingRequest {
  contactEmail: string;
  contactName: string;
  contactPhone: string;
  contactAddress?: Address;
  pickupAddress?: Address;
  scheduledAt: string; // ISO-8601 datetime
  serviceIds: string[];
  beforeServicePhotoUrls?: string[];
}

export interface BookingLineResponse {
  lineId: string;
  serviceId: string;
  priceAtBooking: MoneyAmount;
  durationMinsAtBooking: number;
  pointsValueAtBooking: number;
  requiresPickupAddressAtBooking: boolean;
}

export interface BookingResponse {
  bookingId: string;
  status: string;
  scheduledAt: string;
  totalPrice: MoneyAmount;
  totalDurationMins: number;
  pickupAddress: Address | null;
  beforeServicePhotoUrls: string[];
  lines: BookingLineResponse[];
}

export interface AttachmentSignedUrlRequest {
  fileName: string;
  contentType: 'image/jpeg' | 'image/png';
  tenantSlug: string;
}

export interface AttachmentSignedUrlResponse {
  signedUrl: string;
  filePath: string;
  expiresAt: string;
}
