import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../../../platform/infrastructure/entities/tenant.entity';
import {
  ActiveTenantInfo,
  IReminderTenantPort,
} from '../../application/ports/reminder-tenant.port';

@Injectable()
export class ReminderTenantAdapter implements IReminderTenantPort {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAllActive(): Promise<ActiveTenantInfo[]> {
    const rows = await this.dataSource.getRepository(TenantEntity).find({
      where: { isActive: true },
      select: ['id', 'settings'],
    });

    return rows.map((r) => ({
      id: r.id,
      timezone: r.settings.business_hours?.timezone ?? 'America/Sao_Paulo',
    }));
  }
}
