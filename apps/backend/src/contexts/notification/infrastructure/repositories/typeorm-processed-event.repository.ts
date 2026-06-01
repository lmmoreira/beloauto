import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { INotificationProcessedEventRepository } from '../../application/ports/processed-event-repository.port';
import { NotificationProcessedEventEntity } from '../entities/processed-event.entity';

@Injectable()
export class TypeOrmNotificationProcessedEventRepository implements INotificationProcessedEventRepository {
  constructor(
    @InjectRepository(NotificationProcessedEventEntity)
    private readonly repo: Repository<NotificationProcessedEventEntity>,
  ) {}

  async isDuplicate(eventId: string, notificationType: string, channel: string): Promise<boolean> {
    const count = await this.repo.count({ where: { eventId, notificationType, channel } });
    return count > 0;
  }

  async markProcessed(eventId: string, notificationType: string, channel: string): Promise<void> {
    const entity = new NotificationProcessedEventEntity();
    entity.eventId = eventId;
    entity.notificationType = notificationType;
    entity.channel = channel;
    const conflictPaths: (keyof NotificationProcessedEventEntity)[] = [
      'eventId',
      'notificationType',
      'channel',
    ];
    await this.repo.upsert(entity, conflictPaths);
  }
}
