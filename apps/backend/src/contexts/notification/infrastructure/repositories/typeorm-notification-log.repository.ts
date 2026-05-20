import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getActiveEntityManager } from '../../../../shared/infrastructure/transaction-context';
import { INotificationLogRepository } from '../../application/ports/notification-log-repository.port';
import { NotificationLog } from '../../domain/notification-log.entity';
import { NotificationLogEntity } from '../entities/notification-log.entity';

@Injectable()
export class TypeOrmNotificationLogRepository implements INotificationLogRepository {
  constructor(
    @InjectRepository(NotificationLogEntity)
    private readonly repo: Repository<NotificationLogEntity>,
  ) {}

  async findByEventAndChannel(
    tenantId: string,
    eventId: string,
    notificationType: string,
    channel: string,
  ): Promise<NotificationLog | null> {
    const entity = await this.repo.findOne({
      where: { tenantId, eventId, notificationType, channel },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async save(log: NotificationLog): Promise<void> {
    const manager = getActiveEntityManager();
    const entity = this.toEntity(log);
    if (manager) {
      await manager.save(NotificationLogEntity, entity);
    } else {
      await this.repo.save(entity);
    }
  }

  private toDomain(entity: NotificationLogEntity): NotificationLog {
    return NotificationLog.reconstitute({
      id: entity.id,
      tenantId: entity.tenantId,
      eventId: entity.eventId,
      notificationType: entity.notificationType,
      channel: entity.channel,
      createdAt: entity.createdAt,
    });
  }

  private toEntity(log: NotificationLog): NotificationLogEntity {
    const entity = new NotificationLogEntity();
    entity.id = log.id;
    entity.tenantId = log.tenantId;
    entity.eventId = log.eventId;
    entity.notificationType = log.notificationType;
    entity.channel = log.channel;
    entity.createdAt = log.createdAt;
    return entity;
  }
}
