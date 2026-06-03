import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as transactionContext from '../../../../shared/infrastructure/transaction-context';
import { NotificationLog } from '../../domain/notification-log.entity';
import { NotificationLogEntity } from '../entities/notification-log.entity';
import { TypeOrmNotificationLogRepository } from './typeorm-notification-log.repository';

const TENANT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
const EVENT_ID = 'bbbbbbbb-0000-4000-8000-000000000001';

const BASE_CREATE_PROPS = {
  tenantId: TENANT_ID,
  eventId: EVENT_ID,
  notificationType: 'booking-approved-customer',
  channel: 'EMAIL',
  recipientEmail: 'joao@example.com',
};

function makeQueryBuilderChain(executeResult: unknown = {}) {
  const execute = jest.fn().mockResolvedValue(executeResult);
  const qb = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute,
  };
  return { qb, execute };
}

describe('TypeOrmNotificationLogRepository', () => {
  let repo: TypeOrmNotificationLogRepository;
  let ormRepo: jest.Mocked<Pick<Repository<NotificationLogEntity>, 'createQueryBuilder'>>;

  beforeEach(async () => {
    const { qb } = makeQueryBuilderChain();
    ormRepo = { createQueryBuilder: jest.fn().mockReturnValue(qb) } as never;

    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmNotificationLogRepository,
        {
          provide: getRepositoryToken(NotificationLogEntity),
          useValue: ormRepo,
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmNotificationLogRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('save', () => {
    it('persists a SENT log via INSERT ON CONFLICT DO NOTHING', async () => {
      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markSent();

      await repo.save(log);

      expect(ormRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      const qb = (ormRepo.createQueryBuilder as jest.Mock).mock.results[0].value;
      expect(qb.insert).toHaveBeenCalledTimes(1);
      expect(qb.orIgnore).toHaveBeenCalledTimes(1);
      expect(qb.execute).toHaveBeenCalledTimes(1);

      const entity = qb.values.mock.calls[0][0] as NotificationLogEntity;
      expect(entity.tenantId).toBe(TENANT_ID);
      expect(entity.eventId).toBe(EVENT_ID);
      expect(entity.notificationType).toBe('booking-approved-customer');
      expect(entity.channel).toBe('EMAIL');
      expect(entity.recipientEmail).toBe('joao@example.com');
      expect(entity.status).toBe('SENT');
      expect(entity.retryCount).toBe(0);
    });

    it('persists a FAILED log with errorMessage', async () => {
      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markFailed('SMTP timeout');

      await repo.save(log);

      const qb = (ormRepo.createQueryBuilder as jest.Mock).mock.results[0].value;
      const entity = qb.values.mock.calls[0][0] as NotificationLogEntity;
      expect(entity.status).toBe('FAILED');
      expect(entity.errorMessage).toBe('SMTP timeout');
      expect(entity.retryCount).toBe(1);
    });

    it('uses active EntityManager createQueryBuilder when one is present', async () => {
      const { qb: managerQb } = makeQueryBuilderChain();
      jest
        .spyOn(transactionContext, 'getActiveEntityManager')
        .mockReturnValue({ createQueryBuilder: jest.fn().mockReturnValue(managerQb) } as never);

      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markSent();

      await repo.save(log);

      expect(managerQb.insert).toHaveBeenCalledTimes(1);
      expect(managerQb.orIgnore).toHaveBeenCalledTimes(1);
      expect(managerQb.execute).toHaveBeenCalledTimes(1);
      expect(ormRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
