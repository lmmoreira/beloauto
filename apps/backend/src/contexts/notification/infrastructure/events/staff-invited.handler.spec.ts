import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../test/repositories/notification/in-memory-notification-log.repository';
import { StaffInvited } from '../../../staff/domain/events/staff-invited.event';
import { INotificationStaffPort } from '../../application/ports/notification-staff.port';
import { INotificationTenantPort } from '../../application/ports/notification-tenant.port';
import { SendStaffInvitationUseCase } from '../../application/use-cases/send-staff-invitation/send-staff-invitation.use-case';
import { StaffInvitedHandler } from './staff-invited.handler';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STAFF_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

const staffPort: INotificationStaffPort = {
  getStaffInfo: async () => ({ id: STAFF_ID, email: 'maria@lavacar.com.br', name: 'Maria' }),
  getManagerEmails: async () => [],
};

const tenantPort: INotificationTenantPort = {
  getTenantInfo: async () => ({ id: TENANT_ID, name: 'Lava Car', slug: 'lavacar' }),
};

function makeHandler() {
  const logRepo = new InMemoryNotificationLogRepository();
  const dispatcher = new InMemoryNotificationDispatcher();
  const useCase = new SendStaffInvitationUseCase(
    logRepo,
    dispatcher,
    staffPort,
    tenantPort,
    new InMemoryTransactionManager(),
  );
  const eventBus = new InMemoryEventBus();
  const handler = new StaffInvitedHandler(useCase, eventBus);
  return { handler, dispatcher, logRepo };
}

function makeEvent(staffId = STAFF_ID): StaffInvited {
  return new StaffInvited(TENANT_ID, 'corr-handler-test', { staffId });
}

describe('StaffInvitedHandler', () => {
  it('delegates to SendStaffInvitationUseCase and dispatches email', async () => {
    const { handler, dispatcher, logRepo } = makeHandler();

    await handler.handle(makeEvent());

    expect(dispatcher.dispatched).toHaveLength(1);
    expect(dispatcher.dispatched[0].to).toBe('maria@lavacar.com.br');
    expect(logRepo.all).toHaveLength(1);
  });

  it('is idempotent: same event delivered twice dispatches email only once', async () => {
    const { handler, dispatcher } = makeHandler();
    const event = makeEvent();

    await handler.handle(event);
    await handler.handle(event);

    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('handles invitedBy = SYSTEM_ACTOR_ID (provisioning case) without error', async () => {
    const systemStaffPort: INotificationStaffPort = {
      getStaffInfo: async () => ({
        id: STAFF_ID,
        email: 'admin@tenant.com.br',
        name: null,
      }),
      getManagerEmails: async () => [],
    };

    const logRepo = new InMemoryNotificationLogRepository();
    const dispatcher = new InMemoryNotificationDispatcher();
    const useCase = new SendStaffInvitationUseCase(
      logRepo,
      dispatcher,
      systemStaffPort,
      tenantPort,
      new InMemoryTransactionManager(),
    );
    const handler = new StaffInvitedHandler(useCase, new InMemoryEventBus());

    await expect(handler.handle(makeEvent())).resolves.not.toThrow();
    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('rethrows use case errors so Pub/Sub can nack and retry', async () => {
    const failingDispatcher = {
      dispatch: async () => {
        throw new Error('SMTP down');
      },
    } as unknown as InMemoryNotificationDispatcher;

    const failUseCase = new SendStaffInvitationUseCase(
      new InMemoryNotificationLogRepository(),
      failingDispatcher,
      staffPort,
      tenantPort,
      new InMemoryTransactionManager(),
    );
    const failHandler = new StaffInvitedHandler(failUseCase, new InMemoryEventBus());

    await expect(failHandler.handle(makeEvent())).rejects.toThrow('SMTP down');
  });
});
