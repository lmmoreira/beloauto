import {
  IServiceCatalogPort,
  ServiceSummary,
} from '../../contexts/loyalty/application/ports/service-catalog.port';

export class InMemoryServiceCatalogPort implements IServiceCatalogPort {
  private readonly services: ServiceSummary[] = [];

  seed(services: ServiceSummary[]): void {
    this.services.push(...services);
  }

  async findServicesByIds(_tenantId: string, serviceIds: string[]): Promise<ServiceSummary[]> {
    return this.services.filter((s) => serviceIds.includes(s.serviceId));
  }

  clear(): void {
    this.services.length = 0;
  }
}
