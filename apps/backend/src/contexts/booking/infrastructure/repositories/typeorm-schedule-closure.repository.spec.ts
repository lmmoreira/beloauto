import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScheduleClosureEntityBuilder } from '../../../../test/builders/booking/index';
import { ClosureReason, ScheduleClosure } from '../../domain/schedule-closure.aggregate';
import { ScheduleClosureEntity } from '../entities/schedule-closure.entity';
import { TypeOrmScheduleClosureRepository } from './typeorm-schedule-closure.repository';

const TENANT_ID = '00000000-0000-7000-8000-000000000001';
const STAFF_ID = '00000000-0000-7000-8000-000000000002';
const CLOSURE_ID = '00000000-0000-7000-8000-000000000003';

describe('TypeOrmScheduleClosureRepository', () => {
  let repo: TypeOrmScheduleClosureRepository;
  let ormRepo: jest.Mocked<Repository<ScheduleClosureEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmScheduleClosureRepository,
        {
          provide: getRepositoryToken(ScheduleClosureEntity),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmScheduleClosureRepository);
    ormRepo = moduleRef.get(getRepositoryToken(ScheduleClosureEntity));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findById', () => {
    it('returns null when entity not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repo.findById(CLOSURE_ID, TENANT_ID);
      expect(result).toBeNull();
    });

    it('maps entity to ScheduleClosure domain aggregate', async () => {
      const entity = new ScheduleClosureEntityBuilder()
        .withId(CLOSURE_ID)
        .withTenantId(TENANT_ID)
        .withDate('2026-12-25')
        .withReason(ClosureReason.HOLIDAY)
        .withNotes('Christmas')
        .withCreatedBy(STAFF_ID)
        .build();
      ormRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findById(CLOSURE_ID, TENANT_ID);

      expect(result).toBeInstanceOf(ScheduleClosure);
      expect(result!.id).toBe(CLOSURE_ID);
      expect(result!.tenantId).toBe(TENANT_ID);
      expect(result!.date).toBe('2026-12-25');
      expect(result!.reason).toBe(ClosureReason.HOLIDAY);
      expect(result!.notes).toBe('Christmas');
      expect(result!.createdBy).toBe(STAFF_ID);
    });
  });

  describe('findByTenantAndDate', () => {
    it('returns null when no closure on date', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      const result = await repo.findByTenantAndDate(TENANT_ID, '2026-12-25');
      expect(result).toBeNull();
    });

    it('returns closure when found', async () => {
      const entity = new ScheduleClosureEntityBuilder()
        .withTenantId(TENANT_ID)
        .withDate('2026-12-25')
        .build();
      ormRepo.findOne.mockResolvedValue(entity);

      const result = await repo.findByTenantAndDate(TENANT_ID, '2026-12-25');

      expect(result).toBeInstanceOf(ScheduleClosure);
      expect(result!.date).toBe('2026-12-25');
    });
  });

  describe('findByTenantAndDateRange', () => {
    it('returns closures sorted by date', async () => {
      const entities = [
        new ScheduleClosureEntityBuilder().withId('id-1').withDate('2026-12-25').build(),
        new ScheduleClosureEntityBuilder().withId('id-2').withDate('2026-12-26').build(),
      ];
      ormRepo.find.mockResolvedValue(entities);

      const result = await repo.findByTenantAndDateRange(TENANT_ID, '2026-12-01', '2026-12-31');

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(ScheduleClosure);
      expect(ormRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ order: { date: 'ASC' } }),
      );
    });

    it('returns empty array when no closures in range', async () => {
      ormRepo.find.mockResolvedValue([]);
      const result = await repo.findByTenantAndDateRange(TENANT_ID, '2026-12-01', '2026-12-31');
      expect(result).toHaveLength(0);
    });
  });

  describe('save', () => {
    it('maps ScheduleClosure domain to entity and calls repo.save', async () => {
      ormRepo.save.mockResolvedValue(new ScheduleClosureEntityBuilder().build());
      const closure = ScheduleClosure.reconstitute({
        id: CLOSURE_ID,
        tenantId: TENANT_ID,
        date: '2026-12-25',
        reason: ClosureReason.HOLIDAY,
        notes: null,
        createdBy: STAFF_ID,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      });

      await repo.save(closure);

      expect(ormRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: CLOSURE_ID,
          tenantId: TENANT_ID,
          date: '2026-12-25',
          reason: ClosureReason.HOLIDAY,
          notes: null,
          createdBy: STAFF_ID,
        }),
      );
    });
  });

  describe('delete', () => {
    it('calls repo.delete with id and tenantId', async () => {
      ormRepo.delete.mockResolvedValue({ affected: 1, raw: [] });

      await repo.delete(CLOSURE_ID, TENANT_ID);

      expect(ormRepo.delete).toHaveBeenCalledWith({ id: CLOSURE_ID, tenantId: TENANT_ID });
    });
  });
});
