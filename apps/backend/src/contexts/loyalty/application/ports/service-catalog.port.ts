export const SERVICE_CATALOG_PORT = Symbol('IServiceCatalogPort');

export interface ServiceSummary {
  serviceId: string;
  serviceName: string;
}

export interface IServiceCatalogPort {
  findServicesByIds(tenantId: string, serviceIds: string[]): Promise<ServiceSummary[]>;
}
