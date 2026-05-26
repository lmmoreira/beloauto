import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from '../../domain/notification-log.entity';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { TypeOrmNotificationLogRepository } from './typeorm-notification-log.repository';
import { NotificationLogEntityBuilder } from '../../../../test/builders/notification/notification-log-entity.builder';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const EVENT_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

describe('TypeOrmNotificationLogRepository', () => {
  let repo: TypeOrmNotificationLogRepository;
  let ormRepo: jest.Mocked<Repository<NotificationLogEntity>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmNotificationLogRepository,
        {
          provide: getRepositoryToken(NotificationLogEntity),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmNotificationLogRepository);
    ormRepo = moduleRef.get(getRepositoryToken(NotificationLogEntity));
  });

  describe('findByEventAndChannel', () => {
    it('returns null when no row found', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      const result = await repo.findByEventAndChannel(
        TENANT_ID,
        EVENT_ID,
        'STAFF_INVITED',
        'EMAIL',
      );

      expect(result).toBeNull();
    });

    it('maps entity to NotificationLog domain object', async () => {
      ormRepo.findOne.mockResolvedValue(
        new NotificationLogEntityBuilder().withTenantId(TENANT_ID).withEventId(EVENT_ID).build(),
      );

      const result = await repo.findByEventAndChannel(
        TENANT_ID,
        EVENT_ID,
        'STAFF_INVITED',
        'EMAIL',
      );

      expect(result).toBeInstanceOf(NotificationLog);
      expect(result!.tenantId).toBe(TENANT_ID);
      expect(result!.eventId).toBe(EVENT_ID);
      expect(result!.notificationType).toBe('STAFF_INVITED');
      expect(result!.channel).toBe('EMAIL');
    });

    it('passes all query params to findOne', async () => {
      ormRepo.findOne.mockResolvedValue(null);

      await repo.findByEventAndChannel(TENANT_ID, EVENT_ID, 'STAFF_INVITED', 'EMAIL');

      expect(ormRepo.findOne).toHaveBeenCalledWith({
        where: {
          tenantId: TENANT_ID,
          eventId: EVENT_ID,
          notificationType: 'STAFF_INVITED',
          channel: 'EMAIL',
        },
      });
    });
  });

  describe('save', () => {
    it('persists the notification log via TypeORM save', async () => {
      ormRepo.save.mockResolvedValue(
        new NotificationLogEntityBuilder().withTenantId(TENANT_ID).withEventId(EVENT_ID).build(),
      );
      const log = NotificationLog.create({
        tenantId: TENANT_ID,
        eventId: EVENT_ID,
        notificationType: 'STAFF_INVITED',
        channel: 'EMAIL',
      });

      await repo.save(log);

      expect(ormRepo.save).toHaveBeenCalledTimes(1);
      const saved = ormRepo.save.mock.calls[0][0] as NotificationLogEntity;
      expect(saved.tenantId).toBe(TENANT_ID);
      expect(saved.eventId).toBe(EVENT_ID);
      expect(saved.notificationType).toBe('STAFF_INVITED');
      expect(saved.channel).toBe('EMAIL');
    });
  });
});
