import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { TenantEntityBuilder } from '../../../../test/builders/platform';
import { HotsiteConfigEntity } from '../entities/hotsite-config.entity';
import { TenantEntity } from '../entities/tenant.entity';
import { PlatformModule } from '../../platform.module';
import { EventBusModule } from '../../../../shared/infrastructure/event-bus.module';
import { TransactionManagerModule } from '../../../../shared/infrastructure/transaction-manager.module';
import { RoutingInMemoryEventBus } from '../../../../test/infrastructure/routing-in-memory-event-bus';
import { EVENT_BUS } from '../../../../shared/ports/event-bus.port';
import { InternalApiGuard } from '../../../../shared/guards/internal-api.guard';

const INTERNAL_KEY = 'integ-read-key-integ-read-key-xx'; // exactly 32 chars

describe('InternalTenantReadController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    process.env['PLATFORM_ADMIN_KEY'] = 'integ-read-key-integ-read-key-xx';
    process.env['INTERNAL_API_KEY'] = INTERNAL_KEY;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [TenantEntity, HotsiteConfigEntity],
          synchronize: false,
        }),
        EventBusModule,
        TransactionManagerModule,
        PlatformModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: InternalApiGuard }],
    })
      .overrideProvider(EVENT_BUS)
      .useValue(new RoutingInMemoryEventBus())
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    ds = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
    delete process.env['PLATFORM_ADMIN_KEY'];
    delete process.env['INTERNAL_API_KEY'];
  });

  it('returns 401 when X-Internal-Key header is absent', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/internal/tenants/00000000-0000-0000-0000-000000000000')
      .expect(401);

    expect(body.status).toBe(401);
    expect(body.type).toBe('about:blank');
  });

  it('returns 404 for an unknown tenant ID', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/internal/tenants/00000000-0000-0000-0000-000000000000')
      .set('X-Internal-Key', INTERNAL_KEY)
      .expect(404);

    expect(body.status).toBe(404);
    expect(body.type).toBe('about:blank');
  });

  it('returns tenant info for a known tenant ID', async () => {
    const entity = new TenantEntityBuilder()
      .withId('a1b2c3d4-0000-0000-0000-000000000001')
      .withSlug('read-integ-tenant-01')
      .build();
    await ds.getRepository(TenantEntity).save(entity);

    const { body } = await request(app.getHttpServer())
      .get('/internal/tenants/a1b2c3d4-0000-0000-0000-000000000001')
      .set('X-Internal-Key', INTERNAL_KEY)
      .expect(200);

    expect(body.id).toBe('a1b2c3d4-0000-0000-0000-000000000001');
    expect(body.slug).toBe('read-integ-tenant-01');
    expect(body.name).toBe('BeloAuto');
  });

  it('returns tenant info for a known slug', async () => {
    const entity = new TenantEntityBuilder()
      .withId('a1b2c3d4-0000-0000-0000-000000000002')
      .withSlug('read-integ-tenant-02')
      .build();
    await ds.getRepository(TenantEntity).save(entity);

    const { body } = await request(app.getHttpServer())
      .get('/internal/tenants/by-slug/read-integ-tenant-02')
      .set('X-Internal-Key', INTERNAL_KEY)
      .expect(200);

    expect(body.id).toBe('a1b2c3d4-0000-0000-0000-000000000002');
    expect(body.slug).toBe('read-integ-tenant-02');
  });
});
