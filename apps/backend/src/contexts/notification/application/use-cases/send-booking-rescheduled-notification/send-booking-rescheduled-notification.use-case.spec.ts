import { InMemoryNotificationDispatcher } from '../../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../../test/repositories/notification/in-memory-notification-log.repository';
import { InMemoryNotificationStaffPort } from '../../../../../test/infrastructure/in-memory-notification-staff.port';
import { InMemoryNotificationTenantPort } from '../../../../../test/infrastructure/in-memory-notification-tenant.port';
import { InMemoryTransactionManager } from '../../../../../test/infrastructure/in-memory-transaction-manager';
import { SendBookingRescheduledNotificationDto } from '../../dtos/send-booking-rescheduled-notification.dto';
import { SendBookingRescheduledNotificationUseCase } from './send-booking-rescheduled-notification.use-case';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const EVENT_ID = 'cccccccc-0002-4000-8000-000000000001';

const baseDto: SendBookingRescheduledNotificationDto = {
  tenantId: TENANT_ID,
  eventId: EVENT_ID,
  correlationId: 'corr-rescheduled-1',
  guestEmail: 'joao@example.com',
  guestName: 'João Silva',
  previousSlot: { startTime: '2026-07-01T13:00:00.000Z', endTime: '2026-07-01T14:00:00.000Z' },
  newSlot: { startTime: '2026-07-07T13:00:00.000Z', endTime: '2026-07-07T14:00:00.000Z' },
  rescheduledBy: 'staffid-0000-4000-8000-000000000001',
  adminNotes: null,
  lineSummary: [
    {
      serviceNameAtBooking: 'Lavagem Completa',
      priceAtBooking: { amount: '150.00', currency: 'BRL' },
    },
  ],
  totalPrice: { amount: '150.00', currency: 'BRL' },
};

describe('SendBookingRescheduledNotificationUseCase', () => {
  let logRepo: InMemoryNotificationLogRepository;
  let dispatcher: InMemoryNotificationDispatcher;
  let staffPort: InMemoryNotificationStaffPort;
  let tenantPort: InMemoryNotificationTenantPort;
  let useCase: SendBookingRescheduledNotificationUseCase;

  beforeEach(() => {
    logRepo = new InMemoryNotificationLogRepository();
    dispatcher = new InMemoryNotificationDispatcher();
    staffPort = new InMemoryNotificationStaffPort();
    staffPort.setManagerEmails(TENANT_ID, ['manager@lavacar.com.br']);
    tenantPort = new InMemoryNotificationTenantPort();
    tenantPort.setTenantInfo(TENANT_ID, {
      id: TENANT_ID,
      name: 'Lava Car',
      slug: 'lavacar',
      timezone: 'America/Sao_Paulo',
    });
    useCase = new SendBookingRescheduledNotificationUseCase(
      logRepo,
      dispatcher,
      staffPort,
      tenantPort,
      new InMemoryTransactionManager(),
    );
  });

  it('dispatches customer and admin emails with old and new slot data', async () => {
    const result = await useCase.execute(baseDto);

    expect(result.customerEmailSent).toBe(true);
    expect(result.adminEmailSent).toBe(true);
    expect(dispatcher.dispatched).toHaveLength(2);

    const customerMsg = dispatcher.dispatched.find((m) => m.to === 'joao@example.com');
    expect(customerMsg).toBeDefined();
    expect(customerMsg!.subject).toBe('Seu agendamento foi reagendado');
    expect(customerMsg!.templateKey).toBe('booking-rescheduled-customer');
    expect(customerMsg!.data['guestName']).toBe('João Silva');
    expect(customerMsg!.data['previousLocalDate']).toBeDefined();
    expect(customerMsg!.data['previousLocalTime']).toBeDefined();
    expect(customerMsg!.data['newLocalDate']).toBeDefined();
    expect(customerMsg!.data['newLocalTime']).toBeDefined();
    expect(customerMsg!.data['serviceNames']).toBe('Lavagem Completa');

    const adminMsg = dispatcher.dispatched.find((m) => m.to === 'manager@lavacar.com.br');
    expect(adminMsg).toBeDefined();
    expect(adminMsg!.subject).toBe('Agendamento reagendado');
    expect(adminMsg!.templateKey).toBe('booking-rescheduled-admin');
    expect(adminMsg!.data['previousLocalDate']).toBeDefined();
    expect(adminMsg!.data['newLocalDate']).toBeDefined();

    const logs = logRepo.all;
    expect(logs).toHaveLength(2);
    const types = logs.map((l) => l.notificationType);
    expect(types).toContain('BOOKING_RESCHEDULED_CUSTOMER');
    expect(types).toContain('BOOKING_RESCHEDULED_ADMIN');
  });

  it('old and new dates differ in dispatched data', async () => {
    await useCase.execute(baseDto);

    const customerMsg = dispatcher.dispatched.find(
      (m) => m.templateKey === 'booking-rescheduled-customer',
    );
    expect(customerMsg!.data['previousLocalDate']).not.toBe(customerMsg!.data['newLocalDate']);
  });

  it('skips admin email gracefully when no managers exist', async () => {
    staffPort.setManagerEmails(TENANT_ID, []);

    const result = await useCase.execute(baseDto);

    expect(result.customerEmailSent).toBe(true);
    expect(result.adminEmailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(1);
    expect(dispatcher.dispatched[0].templateKey).toBe('booking-rescheduled-customer');
  });

  it('is idempotent: second call with same eventId dispatches no emails and creates no extra logs', async () => {
    await useCase.execute(baseDto);
    dispatcher.clear();

    const result = await useCase.execute(baseDto);

    expect(result.customerEmailSent).toBe(false);
    expect(result.adminEmailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
    expect(logRepo.all).toHaveLength(2);
  });

  it('tenant isolation: log rows are scoped to the correct tenantId', async () => {
    await useCase.execute(baseDto);

    expect(logRepo.all.every((l) => l.tenantId === TENANT_ID)).toBe(true);
  });
});
