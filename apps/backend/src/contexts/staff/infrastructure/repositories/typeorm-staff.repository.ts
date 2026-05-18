import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getActiveEntityManager } from '../../../../shared/infrastructure/transaction-context';
import { Email } from '../../../../shared/value-objects/email.vo';
import { IStaffRepository } from '../../application/ports/staff-repository.port';
import { Staff, StaffRole } from '../../domain/staff.aggregate';
import { StaffEntity } from '../entities/staff.entity';

@Injectable()
export class TypeOrmStaffRepository implements IStaffRepository {
  constructor(
    @InjectRepository(StaffEntity)
    private readonly repo: Repository<StaffEntity>,
  ) {}

  async findByTenantAndOAuthId(tenantId: string, googleOAuthId: string): Promise<Staff | null> {
    const entity = await this.repo.findOne({ where: { tenantId, googleOAuthId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByGoogleOAuthId(googleOAuthId: string): Promise<Staff | null> {
    const entity = await this.repo.findOne({ where: { googleOAuthId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByTenantAndEmail(tenantId: string, email: string): Promise<Staff | null> {
    const entity = await this.repo.findOne({ where: { tenantId, email } });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string, tenantId: string): Promise<Staff | null> {
    const entity = await this.repo.findOne({ where: { id, tenantId } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllByTenant(tenantId: string): Promise<Staff[]> {
    const entities = await this.repo.find({ where: { tenantId } });
    return entities.map((e) => this.toDomain(e));
  }

  async countActiveManagersByTenant(tenantId: string): Promise<number> {
    return this.repo.count({ where: { tenantId, role: 'MANAGER', isActive: true } });
  }

  async save(staff: Staff): Promise<void> {
    const entity = this.toEntity(staff);
    const manager = getActiveEntityManager();
    if (manager) {
      await manager.save(StaffEntity, entity);
    } else {
      await this.repo.save(entity);
    }
  }

  private toDomain(entity: StaffEntity): Staff {
    return Staff.reconstitute({
      id: entity.id,
      tenantId: entity.tenantId,
      googleOAuthId: entity.googleOAuthId,
      email: Email.create(entity.email),
      role: entity.role as StaffRole,
      isActive: entity.isActive,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    });
  }

  private toEntity(staff: Staff): StaffEntity {
    const entity = new StaffEntity();
    entity.id = staff.id;
    entity.tenantId = staff.tenantId;
    entity.googleOAuthId = staff.googleOAuthId;
    entity.email = staff.email.address;
    entity.role = staff.role;
    entity.isActive = staff.isActive;
    entity.createdAt = staff.createdAt;
    entity.updatedAt = staff.updatedAt;
    return entity;
  }
}
