import { DataSource } from 'typeorm';
import { createTestDataSource } from '../../../../test/test-datasource';
import { CustomerBuilder } from '../../../../test/builders/customer/index';
import { CustomerEntity } from '../entities/customer.entity';
import { TypeOrmCustomerRepository } from './typeorm-customer.repository';

describe('TypeOrmCustomerRepository (integration)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmCustomerRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmCustomerRepository(dataSource.getRepository(CustomerEntity));
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('creates and retrieves a customer — all fields survive the round-trip', async () => {
    const customer = new CustomerBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000010')
      .withGoogleOAuthId('google-sub-m03s01-01')
      .withEmail('joao@lavacar.com.br')
      .withName('João Silva')
      .build();

    await repo.save(customer);

    const found = await repo.findByTenantAndOAuthId(
      '00000000-0000-0000-0000-000000000010',
      'google-sub-m03s01-01',
    );
    expect(found).not.toBeNull();
    expect(found!.id).toBe(customer.id);
    expect(found!.email).toBe('joao@lavacar.com.br');
    expect(found!.name).toBe('João Silva');
    expect(found!.phone).toBeNull();
    expect(found!.defaultAddress).toBeNull();
  });

  it('multi-tenant: same googleOAuthId in two tenants — both rows coexist without constraint error', async () => {
    const sharedSub = 'google-sub-m03s01-shared';

    const customerA = new CustomerBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000011')
      .withGoogleOAuthId(sharedSub)
      .withEmail('shared@a.com')
      .build();

    const customerB = new CustomerBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000012')
      .withGoogleOAuthId(sharedSub)
      .withEmail('shared@b.com')
      .build();

    await repo.save(customerA);
    await repo.save(customerB);

    const foundA = await repo.findByTenantAndOAuthId(
      '00000000-0000-0000-0000-000000000011',
      sharedSub,
    );
    const foundB = await repo.findByTenantAndOAuthId(
      '00000000-0000-0000-0000-000000000012',
      sharedSub,
    );

    expect(foundA).not.toBeNull();
    expect(foundB).not.toBeNull();
    expect(foundA!.id).not.toBe(foundB!.id);
    expect(foundA!.tenantId).toBe('00000000-0000-0000-0000-000000000011');
    expect(foundB!.tenantId).toBe('00000000-0000-0000-0000-000000000012');
  });

  it('tenant isolation: findByTenantAndOAuthId returns null for wrong tenant', async () => {
    const customer = new CustomerBuilder()
      .withTenantId('00000000-0000-0000-0000-000000000013')
      .withGoogleOAuthId('google-sub-m03s01-iso')
      .build();
    await repo.save(customer);

    const wrongTenant = await repo.findByTenantAndOAuthId(
      '00000000-0000-0000-0000-000000000099',
      'google-sub-m03s01-iso',
    );
    expect(wrongTenant).toBeNull();
  });

  it('returns null when customer does not exist', async () => {
    const result = await repo.findByTenantAndOAuthId(
      '00000000-0000-0000-0000-000000000000',
      'google-sub-nonexistent',
    );
    expect(result).toBeNull();
  });
});
