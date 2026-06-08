import { Injectable } from '@nestjs/common';
import { ServiceQueryService } from '../../../booking/application/services/service-query.service';
import { ILoyaltyBookingPort, ServiceSummary } from '../../application/ports/loyalty-booking.port';

@Injectable()
export class LoyaltyBookingAdapter implements ILoyaltyBookingPort {
  constructor(private readonly serviceQueryService: ServiceQueryService) {}

  async findServicesByIds(tenantId: string, serviceIds: string[]): Promise<ServiceSummary[]> {
    if (serviceIds.length === 0) return [];
    const services = await this.serviceQueryService.findByIds(serviceIds, tenantId);
    return services.map((s) => ({ serviceId: s.id, serviceName: s.name }));
  }
}
