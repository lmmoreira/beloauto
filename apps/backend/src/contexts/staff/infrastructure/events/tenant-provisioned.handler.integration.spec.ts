import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SYSTEM_ACTOR_ID } from '../../../../shared/domain/system-actor';
import { TransactionManagerModule } from '../../../../shared/infrastructure/transaction-manager.module';
import { EVENT_BUS } from '../../../../shared/ports/event-bus.port';
import { InMemoryEventBus } from '../../../../test/infrastructure/in-memory-event-bus';
import { TenantProvisioned } from '../../../platform/domain/events/tenant-provisioned.event';
import { STAFF_REPOSITORY } from '../../application/ports/staff-repository.port';
import { StaffInvited } from '../../domain/events/staff-invited.event';
import { StaffEntity } from '../entities/staff.entity';
import { TypeOrmStaffRepository } from '../repositories/typeorm-staff.repository';
import { TenantProvisionedHandler } from './tenant-provisioned.handler';

describe('TenantProvisionedHandler (integration)', () => {
  let module: TestingModule;
  let handler: TenantProvisionedHandler;
  let eventBus: InMemoryEventBus;
  let ds: DataSource;

  beforeAll(async () => {
    eventBus = new InMemoryEventBus();

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [StaffEntity],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([StaffEntity]),
        TransactionManagerModule,
      ],
      providers: [
        { provide: STAFF_REPOSITORY, useClass: TypeOrmStaffRepository },
        { provide: EVENT_BUS, useValue: eventBus },
        TenantProvisionedHandler,
      ],
    }).compile();

    handler = module.get(TenantProvisionedHandler);
    ds = module.get(DataSource);
  });

  afterAll(async () => {
    await ds.destroy();
  });

  it('creates MANAGER staff row and publishes StaffInvited on TenantProvisioned', async () => {
    const TENANT_ID = 'e0400000-0000-4000-8000-000000000001';
    const correlationId = 'corr-int-m04s06-01';

    const event = new TenantProvisioned(TENANT_ID, correlationId, {
      name: 'Lava Car SP',
      slug: 'lavacar-sp',
      adminEmail: 'admin-int-m04s06@lavacar.com.br',
      timezone: 'America/Sao_Paulo',
    });

    await handler.handle(event);

    const row = await ds
      .getRepository(StaffEntity)
      .findOne({ where: { tenantId: TENANT_ID, email: 'admin-int-m04s06@lavacar.com.br' } });

    expect(row).not.toBeNull();
    expect(row!.role).toBe('MANAGER');
    expect(row!.isActive).toBe(false);
    expect(row!.googleOAuthId).toBeNull();
    expect(row!.name).toBeNull();
    expect(row!.invitedBy).toBe(SYSTEM_ACTOR_ID);
    expect(row!.tenantId).toBe(TENANT_ID);

    expect(eventBus.published).toHaveLength(1);
    const published = eventBus.published[0] as StaffInvited;
    expect(published.eventName).toBe('StaffInvited');
    expect(published.data.staffId).toBe(row!.id);
    expect(published.tenantId).toBe(TENANT_ID);
    expect(published.correlationId).toBe(correlationId);
  });

  it('is idempotent: handling the same event twice creates exactly one staff row', async () => {
    const TENANT_ID = 'e0400000-0000-4000-8000-000000000002';
    const correlationId = 'corr-int-m04s06-02';

    const event = new TenantProvisioned(TENANT_ID, correlationId, {
      name: 'Lava Car RJ',
      slug: 'lavacar-rj',
      adminEmail: 'admin-int-m04s06-idem@lavacar.com.br',
      timezone: 'America/Sao_Paulo',
    });

    eventBus.clear();
    await handler.handle(event);
    await handler.handle(event);

    const rows = await ds.getRepository(StaffEntity).find({ where: { tenantId: TENANT_ID } });

    expect(rows).toHaveLength(1);
    expect(eventBus.published).toHaveLength(1);
  });

  it('tenant isolation: staff row has correct tenant_id', async () => {
    const TENANT_ID = 'e0400000-0000-4000-8000-000000000003';
    const OTHER_TENANT = 'e0400000-0000-4000-8000-000000000004';

    const eventA = new TenantProvisioned(TENANT_ID, 'corr-a', {
      name: 'Tenant A',
      slug: 'tenant-a',
      adminEmail: 'admin-int-m04s06-iso@example.com',
      timezone: 'America/Sao_Paulo',
    });

    eventBus.clear();
    await handler.handle(eventA);

    const rowsOtherTenant = await ds
      .getRepository(StaffEntity)
      .find({ where: { tenantId: OTHER_TENANT } });

    expect(rowsOtherTenant).toHaveLength(0);

    const rowA = await ds
      .getRepository(StaffEntity)
      .findOne({ where: { tenantId: TENANT_ID, email: 'admin-int-m04s06-iso@example.com' } });

    expect(rowA).not.toBeNull();
  });
});
