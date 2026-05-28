import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  LoyaltyEntryBuilder,
  LoyaltyEntryEntityBuilder,
} from '../../../../test/builders/loyalty/index';
import { LoyaltyEntry } from '../../domain/loyalty-entry.aggregate';
import { LoyaltyEntryEntity } from '../entities/loyalty-entry.entity';
import { TypeOrmLoyaltyEntryRepository } from './typeorm-loyalty-entry.repository';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const CUSTOMER_ID = '00000000-0000-7000-8000-000000000002';

describe('TypeOrmLoyaltyEntryRepository', () => {
  let repo: TypeOrmLoyaltyEntryRepository;
  let ormRepo: jest.Mocked<Repository<LoyaltyEntryEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmLoyaltyEntryRepository,
        {
          provide: getRepositoryToken(LoyaltyEntryEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmLoyaltyEntryRepository);
    ormRepo = moduleRef.get(getRepositoryToken(LoyaltyEntryEntity));
  });

  describe('save()', () => {
    it('delegates to ormRepo.save with mapped entity', async () => {
      ormRepo.save.mockResolvedValue(
        new LoyaltyEntryEntityBuilder().withTenantId(TENANT_ID).build(),
      );
      const entry = new LoyaltyEntryBuilder().withTenantId(TENANT_ID).build();

      await repo.save(entry);

      expect(ormRepo.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: TENANT_ID }));
    });
  });

  describe('findActiveByCustomer()', () => {
    it('returns empty array when no entries found', async () => {
      ormRepo.find.mockResolvedValue([]);

      const result = await repo.findActiveByCustomer(TENANT_ID, CUSTOMER_ID);

      expect(result).toEqual([]);
    });

    it('maps entities to LoyaltyEntry domain objects', async () => {
      ormRepo.find.mockResolvedValue([
        new LoyaltyEntryEntityBuilder().withTenantId(TENANT_ID).withCustomerId(CUSTOMER_ID).build(),
      ]);

      const result = await repo.findActiveByCustomer(TENANT_ID, CUSTOMER_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(LoyaltyEntry);
      expect(result[0].tenantId).toBe(TENANT_ID);
    });
  });

  describe('calculateActiveBalance()', () => {
    it('returns parsed integer from raw query', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '42' }),
      };
      ormRepo.createQueryBuilder.mockReturnValue(qb as never);

      const result = await repo.calculateActiveBalance(TENANT_ID, CUSTOMER_ID);

      expect(result).toBe(42);
    });

    it('returns 0 when no entries exist', async () => {
      const qb = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
      };
      ormRepo.createQueryBuilder.mockReturnValue(qb as never);

      const result = await repo.calculateActiveBalance(TENANT_ID, CUSTOMER_ID);

      expect(result).toBe(0);
    });
  });

  describe('findExpiringBefore()', () => {
    it('returns empty array when no expiring entries', async () => {
      ormRepo.find.mockResolvedValue([]);

      const result = await repo.findExpiringBefore(new Date());

      expect(result).toEqual([]);
    });

    it('maps expiring entries to LoyaltyEntry domain objects', async () => {
      const pastDate = new Date(Date.now() - 1000);
      ormRepo.find.mockResolvedValue([
        new LoyaltyEntryEntityBuilder().withExpiresAt(pastDate).build(),
      ]);

      const result = await repo.findExpiringBefore(new Date());

      expect(result).toHaveLength(1);
      expect(result[0]).toBeInstanceOf(LoyaltyEntry);
    });
  });
});
