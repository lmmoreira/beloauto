import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getActiveEntityManager } from '../../../../shared/infrastructure/transaction-context';
import {
  CustomerTenantSummary,
  ICustomerRepository,
} from '../../application/ports/customer-repository.port';
import { Customer } from '../../domain/customer.aggregate';
import { CustomerEntity } from '../entities/customer.entity';

@Injectable()
export class TypeOrmCustomerRepository implements ICustomerRepository {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly repo: Repository<CustomerEntity>,
  ) {}

  async findByTenantAndOAuthId(tenantId: string, googleOAuthId: string): Promise<Customer | null> {
    const entity = await this.repo.findOne({ where: { tenantId, googleOAuthId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllTenantsByOAuthId(googleOAuthId: string): Promise<CustomerTenantSummary[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .innerJoin('platform.tenants', 't', 't.id = c.tenant_id AND t.is_active = true')
      .leftJoin(
        'loyalty.loyalty_entries',
        'le',
        'le.tenant_id = c.tenant_id AND le.customer_id = c.id AND le.expires_at > now()',
      )
      .select('c.tenant_id', 'tenantId')
      .addSelect('t.slug', 'tenantSlug')
      .addSelect('COALESCE(SUM(le.points), 0)', 'activePoints')
      .where('c.google_oauth_id = :googleOAuthId', { googleOAuthId })
      .groupBy('c.tenant_id')
      .addGroupBy('t.slug')
      .getRawMany<{ tenantId: string; tenantSlug: string; activePoints: string }>();

    return rows.map((r) => ({
      tenantId: r.tenantId,
      tenantSlug: r.tenantSlug,
      activePoints: Number(r.activePoints),
    }));
  }

  async save(customer: Customer): Promise<void> {
    const entity = this.toEntity(customer);
    const manager = getActiveEntityManager();
    if (manager) {
      await manager.save(CustomerEntity, entity);
    } else {
      await this.repo.save(entity);
    }
  }

  private toDomain(entity: CustomerEntity): Customer {
    return Customer.reconstitute({
      id: entity.id,
      tenantId: entity.tenantId,
      googleOAuthId: entity.googleOAuthId,
      email: entity.email,
      name: entity.name,
      phone: entity.phone,
      defaultAddress: entity.defaultAddress,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private toEntity(customer: Customer): CustomerEntity {
    const entity = new CustomerEntity();
    entity.id = customer.id;
    entity.tenantId = customer.tenantId;
    entity.googleOAuthId = customer.googleOAuthId;
    entity.email = customer.email;
    entity.name = customer.name;
    entity.phone = customer.phone;
    entity.defaultAddress = customer.defaultAddress;
    entity.createdAt = customer.createdAt;
    entity.updatedAt = customer.updatedAt;
    return entity;
  }
}
