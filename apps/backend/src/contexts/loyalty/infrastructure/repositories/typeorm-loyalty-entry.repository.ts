import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { getActiveEntityManager } from '../../../../shared/infrastructure/transaction-context';
import { ILoyaltyEntryRepository } from '../../application/ports/loyalty-entry-repository.port';
import { LoyaltyEntry } from '../../domain/loyalty-entry.aggregate';
import { LoyaltyEntryEntity } from '../entities/loyalty-entry.entity';

@Injectable()
export class TypeOrmLoyaltyEntryRepository implements ILoyaltyEntryRepository {
  constructor(
    @InjectRepository(LoyaltyEntryEntity)
    private readonly repo: Repository<LoyaltyEntryEntity>,
  ) {}

  async save(entry: LoyaltyEntry): Promise<void> {
    const manager = getActiveEntityManager();
    const entity = this.toEntity(entry);
    if (manager) {
      await manager.save(LoyaltyEntryEntity, entity);
    } else {
      await this.repo.save(entity);
    }
  }

  async findActiveByCustomer(tenantId: string, customerId: string): Promise<LoyaltyEntry[]> {
    const now = new Date();
    const entities = await this.repo.find({
      where: { tenantId, customerId, expiresAt: MoreThan(now) },
    });
    return entities.map((e) => this.toDomain(e));
  }

  async calculateActiveBalance(tenantId: string, customerId: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('le')
      .select('COALESCE(SUM(le.points), 0)', 'total')
      .where('le.tenantId = :tenantId', { tenantId })
      .andWhere('le.customerId = :customerId', { customerId })
      .andWhere('le.expiresAt > :now', { now: new Date() })
      .getRawOne<{ total: string }>();
    return parseInt(result?.total ?? '0', 10);
  }

  async findExpiringBefore(date: Date): Promise<LoyaltyEntry[]> {
    const entities = await this.repo.find({
      where: { expiresAt: LessThan(date) },
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toDomain(entity: LoyaltyEntryEntity): LoyaltyEntry {
    return LoyaltyEntry.reconstitute({
      id: entity.id,
      tenantId: entity.tenantId,
      customerId: entity.customerId,
      bookingId: entity.bookingId,
      bookingLineId: entity.bookingLineId,
      serviceId: entity.serviceId,
      points: entity.points,
      earnedAt: entity.earnedAt,
      expiresAt: entity.expiresAt,
    });
  }

  private toEntity(entry: LoyaltyEntry): LoyaltyEntryEntity {
    const entity = new LoyaltyEntryEntity();
    entity.id = entry.id;
    entity.tenantId = entry.tenantId;
    entity.customerId = entry.customerId;
    entity.bookingId = entry.bookingId;
    entity.bookingLineId = entry.bookingLineId;
    entity.serviceId = entry.serviceId;
    entity.points = entry.points;
    entity.earnedAt = entry.earnedAt;
    entity.expiresAt = entry.expiresAt;
    return entity;
  }
}
