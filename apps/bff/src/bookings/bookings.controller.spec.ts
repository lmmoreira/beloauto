import { HttpException } from '@nestjs/common';
import { makeBackendHttp } from '../test/backend-http.mock';
import { BookingsController } from './bookings.controller';
import { BookingResponse } from './bookings.types';

const TENANT_SLUG = 'lavacar-bh';
const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const SERVICE_ID = '30000000-0000-4000-8000-000000000001';

const mockBookingResponse: BookingResponse = {
  bookingId: '40000000-0000-4000-8000-000000000001',
  status: 'PENDING',
  scheduledAt: '2026-06-15T10:00:00.000Z',
  totalPrice: { amount: 100, currency: 'BRL' },
  totalDurationMins: 30,
  pickupAddress: null,
  beforeServicePhotoUrls: [],
  lines: [
    {
      lineId: '50000000-0000-4000-8000-000000000001',
      serviceId: SERVICE_ID,
      priceAtBooking: { amount: 100, currency: 'BRL' },
      durationMinsAtBooking: 30,
      pointsValueAtBooking: 5,
      requiresPickupAddressAtBooking: false,
    },
  ],
};

const validBody = {
  guestEmail: 'joao@example.com',
  guestName: 'João Silva',
  guestPhone: '31999999999',
  scheduledAt: '2026-06-15T10:00:00.000Z',
  serviceIds: [SERVICE_ID],
};

describe('BookingsController', () => {
  afterEach(() => jest.resetAllMocks());

  describe('create()', () => {
    it('returns 400 when X-Tenant-Slug header is missing', async () => {
      const backendHttp = makeBackendHttp();
      const controller = new BookingsController(backendHttp);

      const err = await controller.create(undefined, validBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(400);
    });

    it('resolves slug to tenantId then calls postForPublic /bookings', async () => {
      const tenantInfo = { id: TENANT_ID, slug: TENANT_SLUG, name: 'Lavacar BH' };
      const backendHttp = makeBackendHttp({
        get: jest.fn().mockResolvedValue(tenantInfo),
        postForPublic: jest.fn().mockResolvedValue(mockBookingResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.create(TENANT_SLUG, validBody);

      expect(backendHttp.get).toHaveBeenCalledWith(`/internal/tenants/by-slug/${TENANT_SLUG}`);
      expect(backendHttp.postForPublic).toHaveBeenCalledWith('/bookings', validBody, TENANT_ID);
      expect(result).toBe(mockBookingResponse);
    });

    it('propagates backend errors', async () => {
      const tenantInfo = { id: TENANT_ID, slug: TENANT_SLUG, name: 'Lavacar BH' };
      const backendHttp = makeBackendHttp({
        get: jest.fn().mockResolvedValue(tenantInfo),
        postForPublic: jest.fn().mockRejectedValue(new Error('409')),
      });
      const controller = new BookingsController(backendHttp);

      await expect(controller.create(TENANT_SLUG, validBody)).rejects.toThrow('409');
    });

    it('propagates 404 from backend when slug is not found', async () => {
      const backendHttp = makeBackendHttp({
        get: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 404, detail: 'not found' }, 404)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.create('unknown-slug', validBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  describe('createAuthenticated()', () => {
    const authBody = {
      scheduledAt: '2026-06-15T10:00:00.000Z',
      serviceIds: [SERVICE_ID],
    };

    it('calls post /bookings/authenticated and returns the booking', async () => {
      const backendHttp = makeBackendHttp({
        post: jest.fn().mockResolvedValue(mockBookingResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.createAuthenticated(authBody);

      expect(backendHttp.post).toHaveBeenCalledWith('/bookings/authenticated', authBody);
      expect(result).toBe(mockBookingResponse);
    });

    it('propagates backend errors (422 phone-not-set)', async () => {
      const backendHttp = makeBackendHttp({
        post: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 422, detail: 'phone not set' }, 422)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.createAuthenticated(authBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });
  });
});
