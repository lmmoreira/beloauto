import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { In, DataSource } from 'typeorm';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import {
  INotificationServicePort,
  NotificationServiceInfo,
} from '../../application/ports/notification-service.port';

@Injectable()
export class ServiceInfoAdapter implements INotificationServicePort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findServicesByIds(
    tenantId: string,
    serviceIds: string[],
  ): Promise<NotificationServiceInfo[]> {
    if (serviceIds.length === 0) return [];

    const rows = await this.dataSource
      .getRepository(ServiceEntity)
      .find({ where: { tenantId, id: In(serviceIds) }, select: ['id', 'name'] });

    return rows.map((r) => ({ serviceId: r.id, serviceName: r.name }));
  }
}
