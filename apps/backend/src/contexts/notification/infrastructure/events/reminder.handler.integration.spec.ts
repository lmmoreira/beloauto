import { INestApplication } from '@nestjs/common';
import { uuidv7 } from '../../../../shared/domain/uuid-v7';
import { IEventBus } from '../../../../shared/ports/event-bus.port';
import { NOTIFICATION_STAFF_PORT } from '../../application/ports/notification-staff.port';
import { NOTIFICATION_TENANT_PORT } from '../../application/ports/notification-tenant.port';
import { NOTIFICATION_TEMPLATE_REPOSITORY } from '../../application/ports/notification-template-repository.port';
import { BookingReminderDue } from '../../../booking/domain/events/booking-reminder-due.event';
import { BookingReminderDueToday } from '../../../booking/domain/events/booking-reminder-due-today.event';
import { AdminDailyScheduleReminder } from '../../../booking/domain/events/admin-daily-schedule-reminder.event';
import { NotificationTemplate } from '../../domain/notification-template.aggregate';
import { NotificationTemplateKey } from '../../domain/notification-template-key.enum';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationStaffPort } from '../../../../test/infrastructure/in-memory-notification-staff.port';
import { InMemoryNotificationTenantPort } from '../../../../test/infrastructure/in-memory-notification-tenant.port';
import { InMemoryNotificationTemplateRepository } from '../../../../test/repositories/notification/in-memory-notification-template.repository';
import { createNotificationIntegrationApp } from '../../../../test/utils/notification-integration-app';
import { waitFor } from '../../../../test/utils/wait-for';

const TENANT_A = 'aaaaaaaa-1100-4000-8000-000000000001';
const TENANT_B = 'bbbbbbbb-1100-4000-8000-000000000001';

describe('Reminder handlers (Pub/Sub → handler → use case → dispatcher) integration', () => {
  let app: INestApplication;
  let dispatcher: InMemoryNotificationDispatcher;
  let staffPort: InMemoryNotificationStaffPort;
  let tenantPort: InMemoryNotificationTenantPort;
  let eventBus: IEventBus;

  beforeAll(async () => {
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-reminder-${Date.now()}`;

    dispatcher = new InMemoryNotificationDispatcher();
    staffPort = new InMemoryNotificationStaffPort();
    tenantPort = new InMemoryNotificationTenantPort();

    tenantPort.setTenantInfo(TENANT_A, {
      id: TENANT_A,
      name: 'LavaCar A',
      slug: 'lavacar-a',
      timezone: 'America/Sao_Paulo',
      fromEmail: null,
    });
    tenantPort.setTenantInfo(TENANT_B, {
      id: TENANT_B,
      name: 'LavaCar B',
      slug: 'lavacar-b',
      timezone: 'America/Sao_Paulo',
      fromEmail: null,
    });
    staffPort.setManagerEmails(TENANT_A, ['manager-a@lavacar.com']);
    staffPort.setManagerEmails(TENANT_B, ['manager-b@lavacar.com']);

    // Seed templates for both tenants so reminder use cases can find them without hitting the
    // real DB (which has no tenant-specific copies for these static test UUIDs).
    const templateRepo = new InMemoryNotificationTemplateRepository();
    const reminderSubjectDue = 'Lembrete: seu agendamento é amanhã!';
    const reminderBodyDue =
      '<p>Olá, {{customerName}}! Seu agendamento é amanhã {{localDate}} às {{localTime}}. Serviços: {{serviceNames}}</p>';
    const reminderSubjectToday = 'Lembrete: seu agendamento é hoje!';
    const reminderBodyToday =
      '<p>Olá, {{customerName}}! Seu agendamento é hoje às {{localTime}}. Serviços: {{serviceNames}}</p>';
    const adminSubject = 'Agenda do dia — {{localDate}}';
    const adminBody = '<p>{{bookingsHtml}}</p>';
    for (const tenantId of [TENANT_A, TENANT_B]) {
      templateRepo.seed(
        NotificationTemplate.create({
          tenantId,
          triggerEvent: NotificationTemplateKey.BOOKING_REMINDER_DUE,
          channel: 'EMAIL',
          subject: reminderSubjectDue,
          body: reminderBodyDue,
        }),
      );
      templateRepo.seed(
        NotificationTemplate.create({
          tenantId,
          triggerEvent: NotificationTemplateKey.BOOKING_REMINDER_DUE_TODAY,
          channel: 'EMAIL',
          subject: reminderSubjectToday,
          body: reminderBodyToday,
        }),
      );
      templateRepo.seed(
        NotificationTemplate.create({
          tenantId,
          triggerEvent: NotificationTemplateKey.ADMIN_DAILY_SCHEDULE_REMINDER,
          channel: 'EMAIL',
          subject: adminSubject,
          body: adminBody,
        }),
      );
    }

    ({ app, eventBus } = await createNotificationIntegrationApp({
      dispatcher,
      configure: (builder) =>
        builder
          .overrideProvider(NOTIFICATION_STAFF_PORT)
          .useValue(staffPort)
          .overrideProvider(NOTIFICATION_TENANT_PORT)
          .useValue(tenantPort)
          .overrideProvider(NOTIFICATION_TEMPLATE_REPOSITORY)
          .useValue(templateRepo),
    }));
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  afterEach(() => dispatcher.clear());

  it('BookingReminderDue → dispatches email with day-before subject', async () => {
    const event = new BookingReminderDue(TENANT_A, uuidv7(), {
      bookingId: uuidv7(),
      customerId: uuidv7(),
      recipientEmail: 'joao@example.com',
      customerName: 'João Silva',
      scheduledAt: '2026-07-02T13:00:00.000Z',
      appointmentSlot: {
        startTime: '2026-07-02T13:00:00.000Z',
        endTime: '2026-07-02T14:00:00.000Z',
      },
      lines: [{ serviceId: uuidv7(), serviceName: 'Lavagem Completa' }],
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.length >= 1);

    expect(dispatcher.dispatched[0].subject).toBe('Lembrete: seu agendamento é amanhã!');
    expect(dispatcher.dispatched[0].to).toBe('joao@example.com');
  });

  it('BookingReminderDueToday → dispatches email with day-of subject', async () => {
    const event = new BookingReminderDueToday(TENANT_A, uuidv7(), {
      bookingId: uuidv7(),
      customerId: null,
      recipientEmail: 'maria@example.com',
      customerName: 'Maria Costa',
      scheduledAt: '2026-07-02T09:00:00.000Z',
      appointmentSlot: {
        startTime: '2026-07-02T09:00:00.000Z',
        endTime: '2026-07-02T10:00:00.000Z',
      },
      lines: [{ serviceId: uuidv7(), serviceName: 'Polimento' }],
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.length >= 1);

    expect(dispatcher.dispatched[0].subject).toBe('Lembrete: seu agendamento é hoje!');
    expect(dispatcher.dispatched[0].to).toBe('maria@example.com');
  });

  it('AdminDailyScheduleReminder with 1 booking and 2 managers → dispatches 2 emails', async () => {
    staffPort.setManagerEmails(TENANT_A, ['manager-a1@lavacar.com', 'manager-a2@lavacar.com']);

    const event = new AdminDailyScheduleReminder(TENANT_A, uuidv7(), {
      localDate: '2026-07-02',
      totalBookingsToday: 1,
      bookingsToday: [
        {
          bookingId: uuidv7(),
          customerName: 'Carlos Mendes',
          customerPhone: '+5531988880000',
          lines: [{ serviceId: uuidv7(), serviceName: 'Lavagem Completa' }],
          appointmentSlot: {
            startTime: '2026-07-02T13:00:00.000Z',
            endTime: '2026-07-02T14:00:00.000Z',
          },
          adminNotes: null,
        },
      ],
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.length >= 2);

    expect(dispatcher.dispatched).toHaveLength(2);
    expect(dispatcher.dispatched.every((m) => m.subject.includes('Agenda do dia'))).toBe(true);

    staffPort.setManagerEmails(TENANT_A, ['manager-a@lavacar.com']);
  });

  it('tenant isolation: AdminDailyScheduleReminder for Tenant A does not dispatch to Tenant B managers', async () => {
    const event = new AdminDailyScheduleReminder(TENANT_A, uuidv7(), {
      localDate: '2026-07-03',
      totalBookingsToday: 0,
      bookingsToday: [],
    });

    await eventBus.publish(event);

    await waitFor(async () => dispatcher.dispatched.some((m) => m.to === 'manager-a@lavacar.com'));

    expect(dispatcher.dispatched.some((m) => m.to === 'manager-a@lavacar.com')).toBe(true);
    expect(dispatcher.dispatched.some((m) => m.to === 'manager-b@lavacar.com')).toBe(false);
  });
});
