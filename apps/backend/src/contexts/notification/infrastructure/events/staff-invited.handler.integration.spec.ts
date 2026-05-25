import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { InMemoryNotificationDispatcher } from '../../../../test/infrastructure/in-memory-notification-dispatcher';
import { EventBusModule } from '../../../../shared/infrastructure/event-bus.module';
import { TransactionManagerModule } from '../../../../shared/infrastructure/transaction-manager.module';
import { HotsiteConfigEntity } from '../../../platform/infrastructure/entities/hotsite-config.entity';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import { PlatformModule } from '../../../platform/platform.module';
import { StaffEntity } from '../../../staff/infrastructure/entities/staff.entity';
import { StaffModule } from '../../../staff/staff.module';
import { NOTIFICATION_DISPATCHER } from '../../application/ports/notification-dispatcher.port';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { NotificationModule } from '../../notification.module';
import { waitFor } from '../../../../test/utils/wait-for';

const PLATFORM_KEY = 'notification-story-test-key-xxxxxxxxx';

describe('Story: POST /internal/tenants → Pub/Sub → invitation email dispatched (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;
  let dispatcher: InMemoryNotificationDispatcher;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = PLATFORM_KEY;
    process.env['PUBSUB_SUBSCRIPTION_SUFFIX'] = `-si-${Date.now()}`;
    dispatcher = new InMemoryNotificationDispatcher();

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [TenantEntity, HotsiteConfigEntity, StaffEntity, NotificationLogEntity],
          synchronize: false,
        }),
        EventBusModule,
        TransactionManagerModule,
        PlatformModule,
        StaffModule,
        NotificationModule,
      ],
    })
      .overrideProvider(NOTIFICATION_DISPATCHER)
      .useValue(dispatcher)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    ds = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['PUBSUB_SUBSCRIPTION_SUFFIX'];
  });

  afterEach(() => {
    dispatcher.clear();
  });

  it('provisions tenant → StaffInvited published → invitation email dispatched', async () => {
    const slug = `notif-${Date.now()}`;
    const adminEmail = `admin-notif-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Lava Car Notif', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    expect(body.tenantId).toBeDefined();
    const tenantId: string = body.tenantId;

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'STAFF_INVITED', channel: 'EMAIL' },
      });
      return log !== null;
    });

    const log = await ds.getRepository(NotificationLogEntity).findOne({
      where: { tenantId, notificationType: 'STAFF_INVITED', channel: 'EMAIL' },
    });

    expect(log).not.toBeNull();
    expect(log!.tenantId).toBe(tenantId);
    expect(log!.channel).toBe('EMAIL');

    const msg = dispatcher.dispatched.find((m) => m.to === adminEmail);
    expect(msg).toBeDefined();
    expect(msg!.subject).toContain('Lava Car Notif');
    expect(msg!.data['activationLink']).toContain(slug);
  });

  it('is idempotent: notification log is created only once per event', async () => {
    const slug = `notif-idem-${Date.now()}`;
    const adminEmail = `admin-idem-${Date.now()}@lavacar.com.br`;

    const { body } = await request(app.getHttpServer())
      .post('/internal/tenants')
      .set('Authorization', `Bearer ${PLATFORM_KEY}`)
      .send({ name: 'Idem Notif', slug, adminEmail, timezone: 'America/Sao_Paulo' })
      .expect(201);

    const tenantId: string = body.tenantId;

    await waitFor(async () => {
      const log = await ds.getRepository(NotificationLogEntity).findOne({
        where: { tenantId, notificationType: 'STAFF_INVITED', channel: 'EMAIL' },
      });
      return log !== null;
    });

    const logs = await ds.getRepository(NotificationLogEntity).find({ where: { tenantId } });
    expect(logs).toHaveLength(1);
  });

  it('tenant isolation: notification log is scoped to the correct tenant', async () => {
    const slugA = `iso-notif-a-${Date.now()}`;
    const slugB = `iso-notif-b-${Date.now()}`;
    const emailA = `iso-a-${Date.now()}@lavacar.com.br`;
    const emailB = `iso-b-${Date.now()}@lavacar.com.br`;

    const [resA, resB] = await Promise.all([
      request(app.getHttpServer())
        .post('/internal/tenants')
        .set('Authorization', `Bearer ${PLATFORM_KEY}`)
        .send({ name: 'Iso A Notif', slug: slugA, adminEmail: emailA }),
      request(app.getHttpServer())
        .post('/internal/tenants')
        .set('Authorization', `Bearer ${PLATFORM_KEY}`)
        .send({ name: 'Iso B Notif', slug: slugB, adminEmail: emailB }),
    ]);

    const tenantAId: string = resA.body.tenantId;
    const tenantBId: string = resB.body.tenantId;

    await waitFor(async () => {
      const [a, b] = await Promise.all([
        ds.getRepository(NotificationLogEntity).findOne({ where: { tenantId: tenantAId } }),
        ds.getRepository(NotificationLogEntity).findOne({ where: { tenantId: tenantBId } }),
      ]);
      return a !== null && b !== null;
    });

    const logsA = await ds
      .getRepository(NotificationLogEntity)
      .find({ where: { tenantId: tenantAId } });
    const logsB = await ds
      .getRepository(NotificationLogEntity)
      .find({ where: { tenantId: tenantBId } });

    expect(logsA).toHaveLength(1);
    expect(logsB).toHaveLength(1);
    expect(logsA[0].tenantId).toBe(tenantAId);
    expect(logsB[0].tenantId).toBe(tenantBId);
  });
});
