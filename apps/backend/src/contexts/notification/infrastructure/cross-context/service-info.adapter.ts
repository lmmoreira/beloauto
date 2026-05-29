import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import {
  INotificationServicePort,
  NotificationServiceInfo,
} from '../../application/ports/notification-service.port';

@Injectable()
export class ServiceInfoAdapter implements INotificationServicePort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getServiceInfo(
    serviceId: string,
    tenantId: string,
  ): Promise<NotificationServiceInfo | null> {
    const row = await this.dataSource
      .getRepository(ServiceEntity)
      .findOne({ where: { id: serviceId, tenantId }, select: ['id', 'name'] });

    if (!row) return null;
    return { serviceId: row.id, serviceName: row.name };
  }
}
