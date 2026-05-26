import { HttpException, HttpStatus } from '@nestjs/common';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryBookingAvailabilityPort } from '../../../../test/infrastructure/in-memory-booking-availability';
import { InMemoryScheduleTenantSettingsPort } from '../../../../test/infrastructure/in-memory-schedule-tenant-settings';
import { InMemoryCustomerProfilePort } from '../../../../test/infrastructure/in-memory-customer-profile.port';
import { InMemoryBookingRepository } from '../../../../test/repositories/booking/in-memory-booking.repository';
import { InMemoryServiceRepository } from '../../../../test/repositories/booking/in-memory-service.repository';
import { BookingBuilder, ServiceBuilder } from '../../../../test/builders/booking/index';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { futureDate } from '../../../../test/utils/date-helpers';
import { BookingController } from './booking.controller';
import { RequestBookingUseCase } from '../../application/use-cases/request-booking.use-case';
import { RequestAuthenticatedBookingUseCase } from '../../application/use-cases/request-authenticated-booking.use-case';
import { ApproveBookingUseCase } from '../../application/use-cases/approve-booking.use-case';
import { BookingStatus } from '../../domain/booking.aggregate';

const TENANT_A = '10000000-0000-4000-8000-000000000110';
const TENANT_B = '10000000-0000-4000-8000-000000000111';
const CUSTOMER_ID = '20000000-0000-4000-8000-000000000110';
const STAFF_ID = '20000000-0000-4000-8000-000000000112';
const CORRELATION_ID = 'corr-booking-ctrl-test';

describe('BookingController', () => {
  let controller: BookingController;
  let serviceRepo: InMemoryServiceRepository;
  let bookingRepo: InMemoryBookingRepository;
  let serviceId: string;

  beforeEach(async () => {
    serviceRepo = new InMemoryServiceRepository();
    bookingRepo = new InMemoryBookingRepository();
    const guestCtx = new TenantContextBuilder()
      .withTenantId(TENANT_A)
      .withCorrelationId(CORRELATION_ID)
      .build();
    const customerCtx = new TenantContextBuilder()
      .withTenantId(TENANT_A)
      .withCorrelationId(CORRELATION_ID)
      .withActorId(CUSTOMER_ID)
      .withActorType('CUSTOMER')
      .withActorRole('CUSTOMER')
      .build();
    const staffCtx = new TenantContextBuilder()
      .withTenantId(TENANT_A)
      .withCorrelationId(CORRELATION_ID)
      .withActorId(STAFF_ID)
      .withActorRole('MANAGER')
      .build();
    const customerProfilePort = new InMemoryCustomerProfilePort();
    customerProfilePort.setProfile(CUSTOMER_ID, {
      email: 'cliente@example.com',
      name: 'Maria Silva',
      phone: '31988888888',
      defaultAddress: null,
    });
    controller = new BookingController(
      new RequestBookingUseCase(
        serviceRepo,
        new InMemoryBookingAvailabilityPort(),
        new InMemoryScheduleTenantSettingsPort(),
        bookingRepo,
        new InMemoryTransactionManager(),
        new InMemoryEventBus(),
        guestCtx,
      ),
      new RequestAuthenticatedBookingUseCase(
        customerProfilePort,
        serviceRepo,
        new InMemoryBookingAvailabilityPort(),
        new InMemoryScheduleTenantSettingsPort(),
        bookingRepo,
        new InMemoryTransactionManager(),
        new InMemoryEventBus(),
        customerCtx,
      ),
      new ApproveBookingUseCase(
        staffCtx,
        bookingRepo,
        new InMemoryBookingAvailabilityPort(),
        new InMemoryTransactionManager(),
        new InMemoryEventBus(),
      ),
    );
    const service = new ServiceBuilder().withTenantId(TENANT_A).build();
    await serviceRepo.save(service);
    serviceId = service.id;
  });

  const validBody = () => ({
    guestEmail: 'guest@example.com',
    guestName: 'João Silva',
    guestPhone: '31999999999',
    scheduledAt: `${futureDate(1)}T10:00:00.000Z`,
    serviceIds: [serviceId],
  });

  describe('create()', () => {
    it('returns 201 with bookingId and PENDING status', async () => {
      const result = await controller.create(validBody());
      expect(result.bookingId).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.lines).toHaveLength(1);
    });

    it('maps BookingSlotUnavailableError to 409', async () => {
      const availabilityPort = new InMemoryBookingAvailabilityPort();
      availabilityPort.setSlots([
        { scheduledAt: new Date(`${futureDate(1)}T10:00:00.000Z`), totalDurationMins: 30 },
      ]);
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_A)
        .withCorrelationId(CORRELATION_ID)
        .build();
      const customerProfilePort = new InMemoryCustomerProfilePort();
      const staffCtxB = new TenantContextBuilder()
        .withTenantId(TENANT_A)
        .withActorId(STAFF_ID)
        .build();
      const ctrl = new BookingController(
        new RequestBookingUseCase(
          serviceRepo,
          availabilityPort,
          new InMemoryScheduleTenantSettingsPort(),
          new InMemoryBookingRepository(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          ctx,
        ),
        new RequestAuthenticatedBookingUseCase(
          customerProfilePort,
          serviceRepo,
          new InMemoryBookingAvailabilityPort(),
          new InMemoryScheduleTenantSettingsPort(),
          new InMemoryBookingRepository(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          ctx,
        ),
        new ApproveBookingUseCase(
          staffCtxB,
          new InMemoryBookingRepository(),
          new InMemoryBookingAvailabilityPort(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
        ),
      );
      const err = await ctrl.create(validBody()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('maps BookingServiceNotInTenantError to 400', async () => {
      const err = await controller
        .create({ ...validBody(), serviceIds: ['00000000-0000-4000-8000-000000009999'] })
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    });
  });

  describe('approve()', () => {
    it('approves a PENDING booking and returns 200 shape', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(new Date(`${futureDate(2)}T10:00:00.000Z`))
        .build();
      await bookingRepo.save(booking);

      const result = await controller.approve(booking.id);
      expect(result.status).toBe(BookingStatus.APPROVED);
      expect(result.bookingId).toBe(booking.id);
      expect(result.approvedAt).toBeDefined();
    });

    it('maps BookingNotFoundError to 404', async () => {
      const err = await controller
        .approve('00000000-0000-4000-8000-000000009999')
        .catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });

    it('maps InvalidBookingTransitionError to 422', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withStatus(BookingStatus.REJECTED)
        .withScheduledAt(new Date(`${futureDate(2)}T10:00:00.000Z`))
        .build();
      await bookingRepo.save(booking);

      const err = await controller.approve(booking.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
    });

    it('maps BookingSlotUnavailableError to 409 when slot is taken', async () => {
      const scheduledAt = new Date(`${futureDate(3)}T11:00:00.000Z`);
      const availabilityPort = new InMemoryBookingAvailabilityPort();
      availabilityPort.setSlots([{ scheduledAt, totalDurationMins: 60 }]);
      const staffCtx = new TenantContextBuilder()
        .withTenantId(TENANT_A)
        .withCorrelationId(CORRELATION_ID)
        .withActorId(STAFF_ID)
        .withActorRole('MANAGER')
        .build();
      const bookingRepoB = new InMemoryBookingRepository();
      const ctrl = new BookingController(
        new RequestBookingUseCase(
          serviceRepo,
          new InMemoryBookingAvailabilityPort(),
          new InMemoryScheduleTenantSettingsPort(),
          bookingRepoB,
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          new TenantContextBuilder().withTenantId(TENANT_A).build(),
        ),
        new RequestAuthenticatedBookingUseCase(
          new InMemoryCustomerProfilePort(),
          serviceRepo,
          new InMemoryBookingAvailabilityPort(),
          new InMemoryScheduleTenantSettingsPort(),
          bookingRepoB,
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          new TenantContextBuilder().withTenantId(TENANT_A).build(),
        ),
        new ApproveBookingUseCase(
          staffCtx,
          bookingRepoB,
          availabilityPort,
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
        ),
      );
      const booking = new BookingBuilder()
        .withTenantId(TENANT_A)
        .withScheduledAt(scheduledAt)
        .build();
      await bookingRepoB.save(booking);

      const err = await ctrl.approve(booking.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    });

    it('tenant isolation: cannot approve booking from tenantB (returns 404)', async () => {
      const booking = new BookingBuilder()
        .withTenantId(TENANT_B)
        .withScheduledAt(new Date(`${futureDate(2)}T10:00:00.000Z`))
        .build();
      await bookingRepo.save(booking);

      const err = await controller.approve(booking.id).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
    });
  });

  describe('createAuthenticated()', () => {
    const authBody = () => ({
      scheduledAt: `${futureDate(1)}T10:00:00.000Z`,
      serviceIds: [serviceId],
    });

    it('creates a CUSTOMER booking and returns 201 shape', async () => {
      const result = await controller.createAuthenticated(authBody());
      expect(result.bookingId).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.lines).toHaveLength(1);
    });

    it('maps CustomerPhoneNotSetError to 422', async () => {
      const { CustomerPhoneNotSetError } = await import('../../domain/errors/booking-domain.error');
      const noPhonePort = new InMemoryCustomerProfilePort();
      noPhonePort.setProfile(CUSTOMER_ID, {
        email: 'nophone@example.com',
        name: 'Sem Telefone',
        phone: null,
        defaultAddress: null,
      });
      const ctx = new TenantContextBuilder()
        .withTenantId(TENANT_A)
        .withCorrelationId(CORRELATION_ID)
        .withActorId(CUSTOMER_ID)
        .withActorType('CUSTOMER')
        .build();
      const staffCtxC = new TenantContextBuilder()
        .withTenantId(TENANT_A)
        .withActorId(STAFF_ID)
        .build();
      const ctrl = new BookingController(
        new RequestBookingUseCase(
          serviceRepo,
          new InMemoryBookingAvailabilityPort(),
          new InMemoryScheduleTenantSettingsPort(),
          new InMemoryBookingRepository(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          ctx,
        ),
        new RequestAuthenticatedBookingUseCase(
          noPhonePort,
          serviceRepo,
          new InMemoryBookingAvailabilityPort(),
          new InMemoryScheduleTenantSettingsPort(),
          new InMemoryBookingRepository(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
          ctx,
        ),
        new ApproveBookingUseCase(
          staffCtxC,
          new InMemoryBookingRepository(),
          new InMemoryBookingAvailabilityPort(),
          new InMemoryTransactionManager(),
          new InMemoryEventBus(),
        ),
      );
      const err = await ctrl.createAuthenticated(authBody()).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.UNPROCESSABLE_ENTITY);
      expect(err).not.toBeInstanceOf(CustomerPhoneNotSetError);
    });
  });
});
