import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { Customer } from '../../domain/customer.aggregate';
import { CustomerEntity } from '../entities/customer.entity';
import { TypeOrmCustomerRepository } from './typeorm-customer.repository';

const makeEntity = (overrides: Partial<CustomerEntity> = {}): CustomerEntity => {
  const e = new CustomerEntity();
  e.id = 'cust-id-1';
  e.tenantId = 'tenant-1';
  e.googleOAuthId = 'google-sub-1';
  e.email = 'user@example.com';
  e.name = 'João Silva';
  e.phone = null;
  e.defaultAddress = null;
  e.createdAt = new Date('2026-01-01T00:00:00Z');
  e.updatedAt = new Date('2026-01-01T00:00:00Z');
  return Object.assign(e, overrides);
};

describe('TypeOrmCustomerRepository', () => {
  let repo: TypeOrmCustomerRepository;
  let ormRepo: jest.Mocked<Repository<CustomerEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmCustomerRepository,
        {
          provide: getRepositoryToken(CustomerEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmCustomerRepository);
    ormRepo = moduleRef.get(getRepositoryToken(CustomerEntity));
  });

  it('findByTenantAndOAuthId returns null when no row found', async () => {
    ormRepo.findOne.mockResolvedValue(null);
    const result = await repo.findByTenantAndOAuthId('tenant-1', 'sub-1');
    expect(result).toBeNull();
  });

  it('findByTenantAndOAuthId maps entity to domain aggregate', async () => {
    ormRepo.findOne.mockResolvedValue(makeEntity());
    const result = await repo.findByTenantAndOAuthId('tenant-1', 'google-sub-1');
    expect(result).toBeInstanceOf(Customer);
    expect(result!.email).toBe('user@example.com');
    expect(result!.tenantId).toBe('tenant-1');
  });

  it('save maps domain to entity and calls repo.save', async () => {
    ormRepo.save.mockResolvedValue(makeEntity());
    const customer = Customer.create('tenant-1', 'sub-1', 'a@b.com', 'Maria');
    await repo.save(customer);
    expect(ormRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'a@b.com', tenantId: 'tenant-1' }),
    );
  });
});
