import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { StaffEntityBuilder } from '../../../../test/builders/staff';
import { StaffEntity } from '../entities/staff.entity';
import { StaffModule } from '../../staff.module';

describe('InternalStaffController (integration)', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url: process.env['TEST_DATABASE_URL'],
          entities: [StaffEntity],
          synchronize: false,
        }),
        StaffModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    ds = moduleRef.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 400 when googleOAuthId query param is absent', async () => {
    const { body } = await request(app.getHttpServer()).get('/internal/staff/by-oauth').expect(400);

    expect(body.status).toBe(400);
    expect(body.detail).toContain('googleOAuthId');
  });

  it('returns 404 when no staff is found for the given googleOAuthId', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/internal/staff/by-oauth?googleOAuthId=google-sub-m03s07-unknown')
      .expect(404);

    expect(body.status).toBe(404);
  });

  it('returns StaffAuthInfo for an active staff member', async () => {
    const entity = new StaffEntityBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000050')
      .withGoogleOAuthId('google-sub-m03s07-active')
      .withEmail('gerente-m03s07@lavacar.com.br')
      .withRole('MANAGER')
      .withIsActive(true)
      .build();
    await ds.getRepository(StaffEntity).save(entity);

    const { body } = await request(app.getHttpServer())
      .get('/internal/staff/by-oauth?googleOAuthId=google-sub-m03s07-active')
      .expect(200);

    expect(body.staffId).toBe(entity.id);
    expect(body.tenantId).toBe('00000000-0000-0000-0000-000000000050');
    expect(body.role).toBe('MANAGER');
    expect(body.isActive).toBe(true);
  });

  it('returns isActive=false for a deactivated staff member', async () => {
    const entity = new StaffEntityBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000051')
      .withGoogleOAuthId('google-sub-m03s07-inactive')
      .withEmail('deactivated-m03s07@lavacar.com.br')
      .withRole('STAFF')
      .withIsActive(false)
      .build();
    await ds.getRepository(StaffEntity).save(entity);

    const { body } = await request(app.getHttpServer())
      .get('/internal/staff/by-oauth?googleOAuthId=google-sub-m03s07-inactive')
      .expect(200);

    expect(body.isActive).toBe(false);
    expect(body.role).toBe('STAFF');
  });

  it('tenant isolation: different staff in different tenants are returned independently', async () => {
    const entityA = new StaffEntityBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000052')
      .withGoogleOAuthId('google-sub-m03s07-iso-a')
      .withEmail('staff-a-m03s07@tenanta.com.br')
      .withIsActive(true)
      .build();
    await ds.getRepository(StaffEntity).save(entityA);

    const { body } = await request(app.getHttpServer())
      .get('/internal/staff/by-oauth?googleOAuthId=google-sub-m03s07-iso-a')
      .expect(200);

    expect(body.tenantId).toBe('00000000-0000-0000-0000-000000000052');
    expect(body.staffId).toBe(entityA.id);
  });
});
