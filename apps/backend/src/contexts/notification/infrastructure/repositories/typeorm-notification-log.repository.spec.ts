import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as transactionContext from '../../../../shared/infrastructure/transaction-context';
import { NotificationLog } from '../../domain/notification-log.aggregate';
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

describe('TypeOrmNotificationLogRepository', () => {
  let repo: TypeOrmNotificationLogRepository;
  let repoQueryMock: jest.Mock;

  beforeEach(async () => {
    repoQueryMock = jest.fn().mockResolvedValue([]);

    const moduleRef = await Test.createTestingModule({
      providers: [
        TypeOrmNotificationLogRepository,
        {
          provide: getRepositoryToken(NotificationLogEntity),
          useValue: { query: repoQueryMock } as unknown as Repository<NotificationLogEntity>,
        },
      ],
    }).compile();

    repo = moduleRef.get(TypeOrmNotificationLogRepository);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('save', () => {
    it('upserts a SENT log with correct parameters', async () => {
      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markSent();

      await repo.save(log);

      expect(repoQueryMock).toHaveBeenCalledTimes(1);
      const [sql, params] = repoQueryMock.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('ON CONFLICT');
      expect(sql).toContain('DO UPDATE SET');
      expect(params[1]).toBe(TENANT_ID);
      expect(params[2]).toBe(EVENT_ID);
      expect(params[5]).toBe('joao@example.com');
      expect(params[6]).toBe('SENT');
      expect(params[7]).toBe(0);
      expect(params[8]).toBeNull();
    });

    it('upserts a FAILED log with errorMessage and retryCount=1', async () => {
      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markFailed('SMTP timeout');

      await repo.save(log);

      expect(repoQueryMock).toHaveBeenCalledTimes(1);
      const [, params] = repoQueryMock.mock.calls[0] as [string, unknown[]];
      expect(params[6]).toBe('FAILED');
      expect(params[7]).toBe(1);
      expect(params[8]).toBe('SMTP timeout');
      expect(params[9]).toBeNull();
    });

    it('uses active EntityManager.query when a transaction is active', async () => {
      const managerQueryMock = jest.fn().mockResolvedValue([]);
      jest
        .spyOn(transactionContext, 'getActiveEntityManager')
        .mockReturnValue({ query: managerQueryMock } as never);

      const log = NotificationLog.create(BASE_CREATE_PROPS);
      log.markSent();

      await repo.save(log);

      expect(managerQueryMock).toHaveBeenCalledTimes(1);
      expect(repoQueryMock).not.toHaveBeenCalled();
    });
  });
});
