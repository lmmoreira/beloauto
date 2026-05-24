import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BookingEntityBuilder,
  BookingLineEntityBuilder,
} from '../../../../test/builders/booking/index';
import { BookingStatus } from '../../domain/booking.aggregate';
import { BookingEntity } from '../entities/booking.entity';
import { BookingLineEntity } from '../entities/booking-line.entity';
import { TypeOrmBookingRepository } from './typeorm-booking.repository';

describe('TypeOrmBookingRepository', () => {
  let repo: TypeOrmBookingRepository;
  let ormRepo: jest.Mocked<Repository<BookingEntity>>;
  let ormLineRepo: jest.Mocked<Repository<BookingLineEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmBookingRepository,
        {
          provide: getRepositoryToken(BookingEntity),
          useValue: { findOne: jest.fn(), find: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
        {
          provide: getRepositoryToken(BookingLineEntity),
          useValue: { find: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmBookingRepository);
    ormRepo = moduleRef.get(getRepositoryToken(BookingEntity));
    ormLineRepo = moduleRef.get(getRepositoryToken(BookingLineEntity));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('findById', () => {
    it('returns null when booking not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repo.findById('some-id', 'tenant-1');

      expect(result).toBeNull();
      expect(ormLineRepo.find).not.toHaveBeenCalled();
    });

    it('returns domain aggregate with lines when found', async () => {
      const bookingId = '00000000-0000-7000-8000-000000000010';
      const tenantId = '00000000-0000-7000-8000-000000000001';

      const bookingEntity = new BookingEntityBuilder()
        .withId(bookingId)
        .withTenantId(tenantId)
        .withGuestEmail('joao@example.com')
        .withGuestPhone('31999999999')
        .withTotalPriceAmount('150.00')
        .build();

      const lineEntity = new BookingLineEntityBuilder()
        .withBookingId(bookingId)
        .withTenantId(tenantId)
        .withServiceNameAtBooking('Lavagem Completa')
        .withPriceAtBookingAmount('150.00')
        .withDurationMinsAtBooking(60)
        .build();

      ormRepo.findOne.mockResolvedValue(bookingEntity);
      ormLineRepo.find.mockResolvedValue([lineEntity]);

      const result = await repo.findById(bookingId, tenantId);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(bookingId);
      expect(result!.tenantId).toBe(tenantId);
      expect(result!.guestEmail.address).toBe('joao@example.com');
      expect(result!.totalPrice.amount.toNumber()).toBe(150);
      expect(result!.lines).toHaveLength(1);
      expect(result!.lines[0].serviceNameAtBooking).toBe('Lavagem Completa');
    });

    it('returns null for wrong tenant (isolation)', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repo.findById('some-id', 'wrong-tenant');

      expect(result).toBeNull();
      expect(ormRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'some-id', tenantId: 'wrong-tenant' },
      });
    });
  });

  describe('findAllByTenant', () => {
    it('returns empty array when no bookings found', async () => {
      ormRepo.find.mockResolvedValue([]);

      const result = await repo.findAllByTenant('tenant-1');

      expect(result).toEqual([]);
      expect(ormLineRepo.find).not.toHaveBeenCalled();
    });

    it('fetches lines for all returned bookings in a single query', async () => {
      const tenantId = '00000000-0000-7000-8000-000000000001';
      const bookingId1 = '00000000-0000-7000-8000-000000000011';
      const bookingId2 = '00000000-0000-7000-8000-000000000012';

      ormRepo.find.mockResolvedValue([
        new BookingEntityBuilder().withId(bookingId1).withTenantId(tenantId).build(),
        new BookingEntityBuilder().withId(bookingId2).withTenantId(tenantId).build(),
      ]);
      ormLineRepo.find.mockResolvedValue([
        new BookingLineEntityBuilder().withBookingId(bookingId1).withTenantId(tenantId).build(),
        new BookingLineEntityBuilder().withBookingId(bookingId2).withTenantId(tenantId).build(),
      ]);

      const result = await repo.findAllByTenant(tenantId);

      expect(result).toHaveLength(2);
      expect(result[0].lines).toHaveLength(1);
      expect(result[1].lines).toHaveLength(1);
      expect(ormLineRepo.find).toHaveBeenCalledTimes(1);
    });

    it('applies status filter to the where clause', async () => {
      ormRepo.find.mockResolvedValue([]);

      await repo.findAllByTenant('tenant-1', { status: BookingStatus.APPROVED });

      expect(ormRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 'tenant-1', status: BookingStatus.APPROVED },
        }),
      );
    });
  });

  describe('save', () => {
    it('persists booking entity and replaces lines', async () => {
      ormRepo.save.mockResolvedValue({} as BookingEntity);
      ormLineRepo.delete.mockResolvedValue({ affected: 1, raw: [] });
      (ormLineRepo.save as jest.Mock).mockResolvedValue([]);

      const booking = new BookingEntityBuilder()
        .withId('00000000-0000-7000-8000-000000000020')
        .withTenantId('tenant-1')
        .build();

      const lineEntity = new BookingLineEntityBuilder()
        .withBookingId('00000000-0000-7000-8000-000000000020')
        .withTenantId('tenant-1')
        .build();

      ormRepo.findOne.mockResolvedValue(booking);
      ormLineRepo.find.mockResolvedValue([lineEntity]);

      const aggregate = await repo.findById('00000000-0000-7000-8000-000000000020', 'tenant-1');
      await repo.save(aggregate!);

      expect(ormRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: '00000000-0000-7000-8000-000000000020' }),
      );
      expect(ormLineRepo.delete).toHaveBeenCalledWith({
        bookingId: '00000000-0000-7000-8000-000000000020',
        tenantId: 'tenant-1',
      });
      expect(ormLineRepo.save).toHaveBeenCalled();
    });

    it('maps totalPriceAmount as fixed-point string', async () => {
      ormRepo.save.mockResolvedValue({} as BookingEntity);
      ormLineRepo.delete.mockResolvedValue({ affected: 0, raw: [] });
      (ormLineRepo.save as jest.Mock).mockResolvedValue([]);

      const bookingEntity = new BookingEntityBuilder()
        .withId('00000000-0000-7000-8000-000000000021')
        .withTenantId('tenant-2')
        .withTotalPriceAmount('250.50')
        .build();
      const lineEntity = new BookingLineEntityBuilder()
        .withBookingId('00000000-0000-7000-8000-000000000021')
        .withTenantId('tenant-2')
        .build();

      ormRepo.findOne.mockResolvedValue(bookingEntity);
      ormLineRepo.find.mockResolvedValue([lineEntity]);

      const aggregate = await repo.findById('00000000-0000-7000-8000-000000000021', 'tenant-2');
      await repo.save(aggregate!);

      expect(ormRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ totalPriceAmount: '250.50' }),
      );
    });
  });
});
