import { InMemoryTransactionManager } from '../../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryNotificationDispatcher } from '../../../../../test/infrastructure/in-memory-notification-dispatcher';
import { InMemoryNotificationLogRepository } from '../../../../../test/repositories/notification/in-memory-notification-log.repository';
import { INotificationStaffPort } from '../../ports/notification-staff.port';
import { INotificationTenantPort } from '../../ports/notification-tenant.port';
import { SendStaffInvitationUseCase } from './send-staff-invitation.use-case';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const STAFF_ID = 'bbbbbbbb-0000-4000-8000-000000000001';
const EVENT_ID = 'cccccccc-0000-4000-8000-000000000001';

const staffPort: INotificationStaffPort = {
  getStaffInfo: async (staffId, tenantId) => {
    if (staffId === STAFF_ID && tenantId === TENANT_ID) {
      return { id: STAFF_ID, email: 'maria@lavacar.com.br', name: 'Maria' };
    }
    return null;
  },
};

const tenantPort: INotificationTenantPort = {
  getTenantInfo: async (tenantId) => {
    if (tenantId === TENANT_ID) {
      return { id: TENANT_ID, name: 'Lava Car', slug: 'lavacar' };
    }
    return null;
  },
};

function makeUseCase(
  logRepo = new InMemoryNotificationLogRepository(),
  dispatcher = new InMemoryNotificationDispatcher(),
) {
  return {
    useCase: new SendStaffInvitationUseCase(
      logRepo,
      dispatcher,
      staffPort,
      tenantPort,
      new InMemoryTransactionManager(),
    ),
    logRepo,
    dispatcher,
  };
}

describe('SendStaffInvitationUseCase', () => {
  const dto = {
    staffId: STAFF_ID,
    tenantId: TENANT_ID,
    eventId: EVENT_ID,
    correlationId: 'corr-1',
  };

  it('dispatches an email and saves a notification log', async () => {
    const { useCase, logRepo, dispatcher } = makeUseCase();

    const result = await useCase.execute(dto);

    expect(result.sent).toBe(true);
    expect(dispatcher.dispatched).toHaveLength(1);

    const msg = dispatcher.dispatched[0];
    expect(msg.to).toBe('maria@lavacar.com.br');
    expect(msg.subject).toContain('Lava Car');
    expect(msg.templateKey).toBe('staff-invitation');
    expect(msg.data['tenantName']).toBe('Lava Car');
    expect(msg.data['activationLink']).toContain('lavacar');

    const logs = logRepo.all;
    expect(logs).toHaveLength(1);
    expect(logs[0].tenantId).toBe(TENANT_ID);
    expect(logs[0].eventId).toBe(EVENT_ID);
    expect(logs[0].notificationType).toBe('STAFF_INVITED');
    expect(logs[0].channel).toBe('EMAIL');
  });

  it('is idempotent: second call with same eventId returns sent=false without dispatching', async () => {
    const { useCase, dispatcher } = makeUseCase();

    await useCase.execute(dto);
    const result = await useCase.execute(dto);

    expect(result.sent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(1);
  });

  it('returns sent=false and does not dispatch when staff is not found', async () => {
    const { useCase, dispatcher } = makeUseCase();

    const result = await useCase.execute({ ...dto, staffId: 'unknown-staff-id' });

    expect(result.sent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
  });

  it('returns sent=false and does not dispatch when tenant is not found', async () => {
    const { useCase, dispatcher } = makeUseCase();

    const result = await useCase.execute({ ...dto, tenantId: 'unknown-tenant-id' });

    expect(result.sent).toBe(false);
    expect(dispatcher.dispatched).toHaveLength(0);
  });

  it('tenant isolation: log is scoped to the correct tenantId', async () => {
    const { useCase, logRepo } = makeUseCase();

    await useCase.execute(dto);

    expect(logRepo.all[0].tenantId).toBe(TENANT_ID);
  });
});
