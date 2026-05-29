import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { In, DataSource } from 'typeorm';
import { ServiceEntity } from '../../../booking/infrastructure/entities/service.entity';
import { IServiceCatalogPort, ServiceSummary } from '../../application/ports/service-catalog.port';

@Injectable()
export class ServiceCatalogAdapter implements IServiceCatalogPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findServicesByIds(tenantId: string, serviceIds: string[]): Promise<ServiceSummary[]> {
    if (serviceIds.length === 0) return [];

    const rows = await this.dataSource.getRepository(ServiceEntity).find({
      where: { tenantId, id: In(serviceIds) },
      select: ['id', 'name'],
    });

    return rows.map((r) => ({ serviceId: r.id, serviceName: r.name }));
  }
}
