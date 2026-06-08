import { Inject, Injectable } from '@nestjs/common';
import { Tenant } from '../../domain/tenant.aggregate';
import { TENANT_REPOSITORY, ITenantRepository } from '../ports/tenant-repository.port';

@Injectable()
export class TenantQueryService {
  constructor(@Inject(TENANT_REPOSITORY) private readonly repo: ITenantRepository) {}

  findAllActive(): Promise<Tenant[]> {
    return this.repo.findAllActive();
  }
}
