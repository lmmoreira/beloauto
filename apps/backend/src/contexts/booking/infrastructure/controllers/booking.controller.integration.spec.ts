import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ServiceEntityBuilder } from '../../../../test/builders/booking/index';
import { actorHeaders } from '../../../../test/utils/actor-headers';
import { futureDate } from '../../../../test/utils/date-helpers';
import { createBookingIntegrationApp } from '../../../../test/utils/booking-integration-app';
import { EventBusModule } from '../../../../shared/infrastructure/event-bus.module';
import { PlatformModule } from '../../../platform/platform.module';
import { ServiceEntity } from '../entities/service.entity';
import { BookingEntity } from '../entities/booking.entity';
import { BookingLineEntity } from '../entities/booking-line.entity';

const TEST_KEY = 'booking-integ-test-key-booking-xxxx'; // 36 chars
const ACTOR_ID = '20000000-0000-4000-8000-000000000001';

const scheduledAt = `${futureDate(2)}T13:00:00.000Z`;

function guestHeaders(tenantId: string) {
  return { 'x-tenant-id': tenantId, 'x-correlation-id': 'test-corr-id' };
}

describe('BookingController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let tenantAId: string;
  let tenantBId: string;
  let serviceId: string;
  let servicePickupId: string;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = TEST_KEY;
    ({ app, ds } = await createBookingIntegrationApp({
      extraModules: [EventBusModule, PlatformModule],
      overrideEventBus: true,
    }));

    // Seed tenants via the canonical API — no direct DB access to the platform context.
    const { body: a } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${TEST_KEY}`)
      .send({ name: 'Booking Tenant A', slug: 'booking-tenant-a', adminEmail: 'a@booking.test' })
      .expect(201);
    tenantAId = a.tenantId as string;

    const { body: b } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${TEST_KEY}`)
      .send({ name: 'Booking Tenant B', slug: 'booking-tenant-b', adminEmail: 'b@booking.test' })
      .expect(201);
    tenantBId = b.tenantId as string;

    // Seed services with dynamic tenantId
    const svc = new ServiceEntityBuilder()
      .withTenantId(tenantAId)
      .withName('Lavagem Completa')
      .withPriceAmount('100.00')
      .withDurationMinutes(30)
      .withIsActive(true)
      .build();
    await ds.getRepository(ServiceEntity).save(svc);
    serviceId = svc.id;

    const svcPickup = new ServiceEntityBuilder()
      .withTenantId(tenantAId)
      .withName('Coleta em Domicílio')
      .withPriceAmount('50.00')
      .withDurationMinutes(20)
      .withRequiresPickupAddress(true)
      .withIsActive(true)
      .build();
    await ds.getRepository(ServiceEntity).save(svcPickup);
    servicePickupId = svcPickup.id;
  });

  afterAll(async () => {
    delete process.env['PLATFORM_ADMIN_KEY'];
    await app.close();
  });

  const validBody = () => ({
    guestEmail: 'joao@example.com',
    guestName: 'João Silva',
    guestPhone: '31999999999',
    scheduledAt,
    serviceIds: [serviceId],
  });

  describe('POST /bookings', () => {
    it('creates a PENDING booking and persists all fields', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send(validBody())
        .expect(201);

      expect(body.bookingId).toBeDefined();
      expect(body.status).toBe('PENDING');
      expect(body.totalDurationMins).toBe(30);
      expect(body.totalPrice.amount).toBe(100);
      expect(body.lines).toHaveLength(1);
      expect(body.lines[0].serviceId).toBe(serviceId);

      const row = await ds
        .getRepository(BookingEntity)
        .findOne({ where: { id: body.bookingId, tenantId: tenantAId } });
      expect(row).not.toBeNull();
      expect(row!.status).toBe('PENDING');
      expect(row!.type).toBe('GUEST');
      expect(row!.guestEmail).toBe('joao@example.com');

      const lines = await ds
        .getRepository(BookingLineEntity)
        .find({ where: { bookingId: body.bookingId } });
      expect(lines).toHaveLength(1);
      expect(lines[0].serviceId).toBe(serviceId);
    });

    it('stores beforeServicePhotoUrls', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ ...validBody(), beforeServicePhotoUrls: ['https://s3.example.com/car.jpg'] })
        .expect(201);

      const row = await ds.getRepository(BookingEntity).findOne({ where: { id: body.bookingId } });
      expect(row!.beforeServicePhotoUrls).toContain('https://s3.example.com/car.jpg');
    });

    it('stores pickupAddress when a pickup service is selected', async () => {
      const pickup = {
        street: 'Rua das Flores',
        number: '10',
        neighborhood: 'Centro',
        city: 'Belo Horizonte',
        state: 'MG',
        zipCode: '30100000',
      };
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ ...validBody(), serviceIds: [servicePickupId], pickupAddress: pickup })
        .expect(201);

      expect(body.pickupAddress).not.toBeNull();
      expect(body.pickupAddress.city).toBe('Belo Horizonte');

      const row = await ds.getRepository(BookingEntity).findOne({ where: { id: body.bookingId } });
      expect(row!.pickupAddress).not.toBeNull();
    });

    it('returns 400 when a pickup service is selected but pickupAddress is absent', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ ...validBody(), serviceIds: [servicePickupId] })
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 for an unknown serviceId (not in tenant)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ ...validBody(), serviceIds: ['00000000-0000-4000-8000-000000009999'] })
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 when guestPhone is invalid (too short)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ ...validBody(), guestPhone: 'abc' })
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('returns 400 when serviceIds is missing', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send({ guestEmail: 'x@x.com', guestName: 'X', guestPhone: '31999999999', scheduledAt })
        .expect(400);

      expect(body.status).toBe(400);
    });

    it('tenant isolation: booking belongs to correct tenant', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(guestHeaders(tenantAId))
        .send(validBody())
        .expect(201);

      const wrongTenant = await ds
        .getRepository(BookingEntity)
        .findOne({ where: { id: body.bookingId, tenantId: tenantBId } });
      expect(wrongTenant).toBeNull();
    });

    it('handles bookings with duplicate serviceIds (two lines)', async () => {
      const { body } = await request(app.getHttpServer())
        .post('/bookings')
        .set(actorHeaders(tenantAId, ACTOR_ID))
        .send({ ...validBody(), serviceIds: [serviceId, serviceId] })
        .expect(201);

      expect(body.lines).toHaveLength(2);
      expect(body.totalDurationMins).toBe(60);
    });
  });
});
