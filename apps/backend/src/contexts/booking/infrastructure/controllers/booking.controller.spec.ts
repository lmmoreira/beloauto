import { HttpException, HttpStatus } from '@nestjs/common';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryBookingAvailabilityPort } from '../../../../test/infrastructure/in-memory-booking-availability';
import { InMemoryScheduleTenantSettingsPort } from '../../../../test/infrastructure/in-memory-schedule-tenant-settings';
import { InMemoryBookingRepository } from '../../../../test/repositories/booking/in-memory-booking.repository';
import { InMemoryServiceRepository } from '../../../../test/repositories/booking/in-memory-service.repository';
import { ServiceBuilder } from '../../../../test/builders/booking/index';
import { TenantContextBuilder } from '../../../../test/factories/tenant-context.factory';
import { futureDate } from '../../../../test/utils/date-helpers';
import { BookingController } from './booking.controller';
import { RequestBookingUseCase } from '../../application/use-cases/request-booking.use-case';

const TENANT_A = '10000000-0000-4000-8000-000000000110';
const CORRELATION_ID = 'corr-booking-ctrl-test';

describe('BookingController', () => {
  let controller: BookingController;
  let serviceRepo: InMemoryServiceRepository;
  let serviceId: string;

  beforeEach(async () => {
    serviceRepo = new InMemoryServiceRepository();
    const ctx = new TenantContextBuilder()
      .withTenantId(TENANT_A)
      .withCorrelationId(CORRELATION_ID)
      .build();
    controller = new BookingController(
      new RequestBookingUseCase(
        serviceRepo,
        new InMemoryBookingAvailabilityPort(),
        new InMemoryScheduleTenantSettingsPort(),
        new InMemoryBookingRepository(),
        new InMemoryTransactionManager(),
        new InMemoryEventBus(),
        ctx,
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
});
