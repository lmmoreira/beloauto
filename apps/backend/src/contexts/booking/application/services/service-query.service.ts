import { Inject, Injectable } from '@nestjs/common';
import { Service } from '../../domain/service.aggregate';
import { IServiceRepository, SERVICE_REPOSITORY } from '../ports/service-repository.port';

@Injectable()
export class ServiceQueryService {
  constructor(@Inject(SERVICE_REPOSITORY) private readonly repo: IServiceRepository) {}

  findByIds(ids: string[], tenantId: string): Promise<Service[]> {
    return this.repo.findByIds(ids, tenantId);
  }
}
