import { ConfigService } from '@nestjs/config';
import { InMemoryNotificationDispatcher } from '../../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../../test/repositories/notification/in-memory-notification-log.repository';
import { InMemoryNotificationStaffPort } from '../../../../../test/infrastructure/in-memory-notification-staff.port';
import { InMemoryTransactionManager } from '../../../../../test/infrastructure/in-memory-transaction-manager';
import { SendBookingInfoSubmittedNotificationDto } from '../../dtos/send-booking-info-submitted-notification.dto';
import { SendBookingInfoSubmittedNotificationUseCase } from './send-booking-info-submitted-notification.use-case';

const TENANT_ID = 'aaaaaaaa-0004-4000-8000-000000000001';
const EVENT_ID = 'cccccccc-0004-4000-8000-000000000001';
const BOOKING_ID = 'bbbbbbbb-0004-4000-8000-000000000001';

const baseDto: SendBookingInfoSubmittedNotificationDto = {
  tenantId: TENANT_ID,
  eventId: EVENT_ID,
  correlationId: 'corr-info-sub-1',
  bookingId: BOOKING_ID,
  submittedByEmail: 'joao@example.com',
  infoPayload: { notes: 'Aqui estão as fotos do veículo conforme solicitado' },
};

const configService = {
  getOrThrow: (key: string): string => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    throw new Error(`Unknown config key: ${key}`);
  },
} as unknown as ConfigService;

describe('SendBookingInfoSubmittedNotificationUseCase', () => {
  let logRepo: InMemoryNotificationLogRepository;
  let dispatcher: InMemoryNotificationDispatcher;
  let staffPort: InMemoryNotificationStaffPort;
  let useCase: SendBookingInfoSubmittedNotificationUseCase;

  beforeEach(() => {
    logRepo = new InMemoryNotificationLogRepository();
    dispatcher = new InMemoryNotificationDispatcher();
    staffPort = new InMemoryNotificationStaffPort();
    staffPort.setManagerEmails(TENANT_ID, ['manager@lavacar.com.br']);
    useCase = new SendBookingInfoSubmittedNotificationUseCase(
      logRepo,
      dispatcher,
      staffPort,
      new InMemoryTransactionManager(),
      configService,
    );
  });

  it('dispatches admin email with customer response and booking link', async () => {
    const result = await useCase.execute(baseDto);

    expect(result.emailSent).toBe(true);
    expect(dispatcher.dispatched).toHaveLength(1);

    const msg = dispatcher.dispatched[0];
    expect(msg.to).toBe('manager@lavacar.com.br');
    expect(msg.subject).toBe('Cliente respondeu à solicitação de informações');
    expect(msg.templateKey).toBe('booking-info-submitted-admin');
    expect(msg.data['submittedByEmail']).toBe('joao@example.com');
    expect(msg.data['customerResponse']).toBe('Aqui estão as fotos do veículo conforme solicitado');
    expect(msg.data['bookingLink']).toBe(`http://localhost:3000/dashboard/bookings/${BOOKING_ID}`);

    expect(logRepo.all).toHaveLength(1);
    expect(logRepo.all[0].notificationType).toBe('BOOKING_INFO_SUBMITTED_ADMIN');
  });

  it('sends to all managers when multiple exist', async () => {
    staffPort.setManagerEmails(TENANT_ID, ['mgr1@lavacar.com.br', 'mgr2@lavacar.com.br']);
    await useCase.execute(baseDto);

    expect(dispatcher.dispatched).toHaveLength(2);
    expect(dispatcher.dispatched.map((m) => m.to)).toEqual(
      expect.arrayContaining(['mgr1@lavacar.com.br', 'mgr2@lavacar.com.br']),
    );
    expect(logRepo.all).toHaveLength(1);
  });

  it('skips dispatch and returns emailSent=false when no managers exist', async () => {
    staffPort.setManagerEmails(TENANT_ID, []);
    const result = await useCase.execute(baseDto);

    expect(result.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
    expect(logRepo.all).toHaveLength(0);
  });

  it('is idempotent: second call with same eventId sends no email', async () => {
    await useCase.execute(baseDto);
    dispatcher.clear();
    const result = await useCase.execute(baseDto);

    expect(result.emailSent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
    expect(logRepo.all).toHaveLength(1);
  });

  it('tenant isolation: log is scoped to correct tenantId', async () => {
    await useCase.execute(baseDto);
    expect(logRepo.all.every((l) => l.tenantId === TENANT_ID)).toBe(true);
  });
});
