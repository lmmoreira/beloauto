import { HttpException } from '@nestjs/common';
import { makeBackendHttp } from '../test/backend-http.mock';
import { BookingsController } from './bookings.controller';
import { BookingResponse } from './bookings.types';

const TENANT_SLUG = 'lavacar-bh';
const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const SERVICE_ID = '30000000-0000-4000-8000-000000000001';
const BOOKING_ID = '40000000-0000-4000-8000-000000000001';

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

const mockApproveResponse = {
  bookingId: BOOKING_ID,
  status: 'APPROVED',
  approvedAt: '2026-06-15T13:00:00.000Z',
};

const mockRejectResponse = {
  bookingId: BOOKING_ID,
  status: 'REJECTED',
  rejectedAt: '2026-06-15T13:00:00.000Z',
};

const mockRequestInfoResponse = {
  bookingId: BOOKING_ID,
  status: 'INFO_REQUESTED',
  infoRequestedAt: '2026-06-15T13:00:00.000Z',
};

const mockSubmitInfoResponse = {
  bookingId: BOOKING_ID,
  status: 'PENDING',
  infoSubmittedAt: '2026-06-15T14:00:00.000Z',
};

const validRequestInfoBody = { message: 'Please provide clearer photos of the vehicle' };

const validRejectBody = { reason: 'Service unavailable for that date' };

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

  describe('approve()', () => {
    it('calls patch /bookings/:id/approve and returns the result', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest.fn().mockResolvedValue(mockApproveResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.approve(BOOKING_ID);

      expect(backendHttp.patch).toHaveBeenCalledWith(`/bookings/${BOOKING_ID}/approve`, {});
      expect(result).toBe(mockApproveResponse);
    });

    it('propagates 409 from backend when slot is unavailable', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 409, detail: 'slot unavailable' }, 409)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.approve(BOOKING_ID).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(409);
    });

    it('propagates 422 from backend when transition is invalid', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 422, detail: 'invalid transition' }, 422)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.approve(BOOKING_ID).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('propagates 404 from backend when booking is not found', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 404, detail: 'not found' }, 404)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.approve('unknown-id').catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  describe('reject()', () => {
    it('calls patch /bookings/:id/reject with body and returns the result', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest.fn().mockResolvedValue(mockRejectResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.reject(BOOKING_ID, validRejectBody);

      expect(backendHttp.patch).toHaveBeenCalledWith(
        `/bookings/${BOOKING_ID}/reject`,
        validRejectBody,
      );
      expect(result).toBe(mockRejectResponse);
    });

    it('propagates 422 from backend when transition is invalid', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 422, detail: 'invalid transition' }, 422)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.reject(BOOKING_ID, validRejectBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('propagates 404 from backend when booking is not found', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 404, detail: 'not found' }, 404)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.reject('unknown-id', validRejectBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  describe('requestInfo()', () => {
    it('calls patch /bookings/:id/request-info with body and returns the result', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest.fn().mockResolvedValue(mockRequestInfoResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.requestInfo(BOOKING_ID, validRequestInfoBody);

      expect(backendHttp.patch).toHaveBeenCalledWith(
        `/bookings/${BOOKING_ID}/request-info`,
        validRequestInfoBody,
      );
      expect(result).toBe(mockRequestInfoResponse);
    });

    it('propagates 422 from backend when booking is not in PENDING state', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 422, detail: 'invalid transition' }, 422)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller
        .requestInfo(BOOKING_ID, validRequestInfoBody)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('propagates 404 from backend when booking is not found', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 404, detail: 'not found' }, 404)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller
        .requestInfo('unknown-id', validRequestInfoBody)
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(404);
    });
  });

  describe('submitInfo()', () => {
    const validSubmitBody = { response: 'Here are the photos you requested' };

    it('calls patch /bookings/:id/submit-info with body and returns the result', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest.fn().mockResolvedValue(mockSubmitInfoResponse),
      });
      const controller = new BookingsController(backendHttp);

      const result = await controller.submitInfo(BOOKING_ID, validSubmitBody);

      expect(backendHttp.patch).toHaveBeenCalledWith(
        `/bookings/${BOOKING_ID}/submit-info`,
        validSubmitBody,
      );
      expect(result).toBe(mockSubmitInfoResponse);
    });

    it('propagates 403 from backend when caller is not the booking owner', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 403, detail: 'forbidden' }, 403)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.submitInfo(BOOKING_ID, validSubmitBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(403);
    });

    it('propagates 422 from backend when booking is not INFO_REQUESTED', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 422, detail: 'invalid transition' }, 422)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller.submitInfo(BOOKING_ID, validSubmitBody).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(422);
    });

    it('propagates 404 from backend when booking is not found', async () => {
      const backendHttp = makeBackendHttp({
        patch: jest
          .fn()
          .mockRejectedValue(new HttpException({ status: 404, detail: 'not found' }, 404)),
      });
      const controller = new BookingsController(backendHttp);

      const err = await controller
        .submitInfo('unknown-id', validSubmitBody)
        .catch((e: unknown) => e);
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
