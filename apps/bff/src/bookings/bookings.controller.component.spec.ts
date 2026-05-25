import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  MockHttpService,
  MockBackendHttpService,
  createTestApp,
  makeCustomerJwt,
  makeManagerJwt,
  setupActiveGuardMock,
  request,
  TENANT_ID,
} from '../test/component-test.helpers';
import { BookingResponse } from './bookings.types';

const TENANT_SLUG = 'lavacar-bh';
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

const tenantInfo = { id: TENANT_ID, slug: TENANT_SLUG, name: 'Lavacar BH' };

const validGuestBody = {
  guestEmail: 'joao@example.com',
  guestName: 'João Silva',
  guestPhone: '31999999999',
  scheduledAt: '2026-06-15T10:00:00.000Z',
  serviceIds: [SERVICE_ID],
};

const validAuthBody = {
  scheduledAt: '2026-06-15T10:00:00.000Z',
  serviceIds: [SERVICE_ID],
};

describe('BookingsController (component)', () => {
  let app: INestApplication;
  let jwtService: JwtService;
  let httpService: MockHttpService;
  let backendHttpService: MockBackendHttpService;
  let restoreEnv: () => void;

  beforeAll(async () => {
    ({ app, jwtService, httpService, backendHttpService, restoreEnv } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
    restoreEnv();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('POST /v1/bookings (public — guest)', () => {
    it('returns 400 when X-Tenant-Slug header is missing', async () => {
      const res = await request(app.getHttpServer()).post('/v1/bookings').send(validGuestBody);
      expect(res.status).toBe(400);
      expect(res.body.status).toBe(400);
    });

    it('returns 400 when body fails Zod validation (missing guestEmail)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .send({ ...validGuestBody, guestEmail: 'not-an-email' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when guestPhone is invalid (too short)', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .send({ ...validGuestBody, guestPhone: 'abc' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when serviceIds is empty', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .send({ ...validGuestBody, serviceIds: [] });
      expect(res.status).toBe(400);
    });

    it('creates a booking without a JWT (guest flow)', async () => {
      backendHttpService.get.mockResolvedValueOnce(tenantInfo);
      backendHttpService.postForPublic = jest.fn().mockResolvedValueOnce(mockBookingResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .send(validGuestBody);

      expect(res.status).toBe(201);
      expect(res.body.bookingId).toBe(mockBookingResponse.bookingId);
      expect(res.body.status).toBe('PENDING');
      expect(backendHttpService.postForPublic).toHaveBeenCalledWith(
        '/bookings',
        expect.objectContaining({ guestEmail: validGuestBody.guestEmail }),
        TENANT_ID,
      );
    });

    it('also accepts a request with a MANAGER JWT (non-guest flow uses same endpoint)', async () => {
      const token = makeManagerJwt(jwtService);
      setupActiveGuardMock(httpService);
      backendHttpService.get.mockResolvedValueOnce(tenantInfo);
      backendHttpService.postForPublic = jest.fn().mockResolvedValueOnce(mockBookingResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .set('Authorization', `Bearer ${token}`)
        .send(validGuestBody);

      expect(res.status).toBe(201);
    });

    it('propagates 409 from backend when slot is unavailable', async () => {
      const { HttpException: HE } = await import('@nestjs/common');
      backendHttpService.get.mockResolvedValueOnce(tenantInfo);
      backendHttpService.postForPublic = jest
        .fn()
        .mockRejectedValueOnce(new HE({ status: 409, detail: 'slot unavailable' }, 409));

      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', TENANT_SLUG)
        .send(validGuestBody);

      expect(res.status).toBe(409);
    });

    it('propagates 404 when tenant slug is not found', async () => {
      const { HttpException: HE } = await import('@nestjs/common');
      backendHttpService.get.mockRejectedValueOnce(
        new HE({ status: 404, detail: 'tenant not found' }, 404),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/bookings')
        .set('X-Tenant-Slug', 'unknown-slug')
        .send(validGuestBody);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /v1/bookings/authenticated', () => {
    it('returns 401 when no JWT is provided', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .send(validAuthBody);
      expect(res.status).toBe(401);
    });

    it('returns 403 when JWT role is not CUSTOMER (MANAGER)', async () => {
      const token = makeManagerJwt(jwtService);
      setupActiveGuardMock(httpService);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send(validAuthBody);
      expect(res.status).toBe(403);
    });

    it('returns 400 when body fails Zod validation (serviceIds empty)', async () => {
      const token = makeCustomerJwt(jwtService);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send({ ...validAuthBody, serviceIds: [] });
      expect(res.status).toBe(400);
    });

    it('returns 400 when scheduledAt is missing', async () => {
      const token = makeCustomerJwt(jwtService);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send({ serviceIds: [SERVICE_ID] });
      expect(res.status).toBe(400);
    });

    it('creates a booking with CUSTOMER JWT', async () => {
      const token = makeCustomerJwt(jwtService);
      backendHttpService.post.mockResolvedValueOnce(mockBookingResponse);

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send(validAuthBody);

      expect(res.status).toBe(201);
      expect(res.body.bookingId).toBe(mockBookingResponse.bookingId);
      expect(backendHttpService.post).toHaveBeenCalledWith(
        '/bookings/authenticated',
        validAuthBody,
      );
    });

    it('propagates 422 from backend when customer phone is not set', async () => {
      const { HttpException: HE } = await import('@nestjs/common');
      const token = makeCustomerJwt(jwtService);
      backendHttpService.post.mockRejectedValueOnce(
        new HE({ status: 422, detail: 'customer-phone-not-set' }, 422),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send(validAuthBody);

      expect(res.status).toBe(422);
    });

    it('propagates 409 from backend when slot is unavailable', async () => {
      const { HttpException: HE } = await import('@nestjs/common');
      const token = makeCustomerJwt(jwtService);
      backendHttpService.post.mockRejectedValueOnce(
        new HE({ status: 409, detail: 'slot-unavailable' }, 409),
      );

      const res = await request(app.getHttpServer())
        .post('/v1/bookings/authenticated')
        .set('Authorization', `Bearer ${token}`)
        .send(validAuthBody);

      expect(res.status).toBe(409);
    });
  });
});
