import { BaseGuestNotificationDto } from './base-guest-notification.dto';

interface AddressDto {
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
}

export interface SendBookingRequestedNotificationDto extends BaseGuestNotificationDto {
  scheduledAt: string;
  totalPrice: { amount: string; currency: string };
  lines: Array<{ serviceNameAtBooking: string }>;
  pickupAddress: AddressDto | null;
}
