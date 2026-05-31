import { InMemoryTransactionManager } from '../../../../test/infrastructure/in-memory-transaction-manager';
import { InMemoryNotificationTemplateRepository } from '../../../../test/repositories/notification/in-memory-notification-template.repository';
import { NotificationTemplateBuilder } from '../../../../test/builders/notification/notification-template.builder';
import { NotificationTemplateKey } from '../../domain/notification-template-key.enum';
import { SeedDefaultTemplatesUseCase } from '../../application/use-cases/seed-default-templates/seed-default-templates.use-case';
import { TenantProvisionedNotificationHandler } from './tenant-provisioned.handler';
import { TenantProvisioned } from '../../../platform/domain/events/tenant-provisioned.event';

const TENANT_ID = '10000000-0000-4000-8000-000000000041';

function makeEvent(tenantId = TENANT_ID): TenantProvisioned {
  return new TenantProvisioned(tenantId, 'corr-id', {
    name: 'Test Tenant',
    slug: 'test-tenant',
    adminEmail: 'admin@test.com',
    timezone: 'America/Sao_Paulo',
  });
}

describe('TenantProvisionedNotificationHandler', () => {
  let templateRepo: InMemoryNotificationTemplateRepository;
  let handler: TenantProvisionedNotificationHandler;

  beforeEach(() => {
    templateRepo = new InMemoryNotificationTemplateRepository();
    const txManager = new InMemoryTransactionManager();
    const seedUseCase = new SeedDefaultTemplatesUseCase(templateRepo, txManager);
    handler = new TenantProvisionedNotificationHandler(seedUseCase, {
      publish: jest.fn(),
      subscribe: jest.fn(),
    });
  });

  it('seeds all global defaults for the new tenant', async () => {
    templateRepo.seed(
      new NotificationTemplateBuilder()
        .asGlobalDefault()
        .withTriggerEvent(NotificationTemplateKey.BOOKING_APPROVED_CUSTOMER)
        .withSubject('Confirmado!')
        .withBody('<p>Ok</p>')
        .build(),
    );

    await handler.handle(makeEvent());

    const tenantTemplate = await templateRepo.findByTriggerEventAndChannel(
      TENANT_ID,
      NotificationTemplateKey.BOOKING_APPROVED_CUSTOMER,
      'EMAIL',
    );
    expect(tenantTemplate).not.toBeNull();
    expect(tenantTemplate!.tenantId).toBe(TENANT_ID);
  });

  it('onModuleInit subscribes to TenantProvisioned with correct consumer name', () => {
    const mockEventBus = { publish: jest.fn(), subscribe: jest.fn() };
    const seedUseCase = new SeedDefaultTemplatesUseCase(
      new InMemoryNotificationTemplateRepository(),
      new InMemoryTransactionManager(),
    );
    const h = new TenantProvisionedNotificationHandler(seedUseCase, mockEventBus);

    h.onModuleInit();

    expect(mockEventBus.subscribe).toHaveBeenCalledWith(
      'TenantProvisioned',
      expect.any(Function),
      'notification-template-seed',
    );
  });

  it('rethrows errors so Pub/Sub nacks and retries', async () => {
    jest.spyOn(templateRepo, 'findAllDefaults').mockRejectedValue(new Error('DB down'));

    await expect(handler.handle(makeEvent())).rejects.toThrow('DB down');
  });
});
