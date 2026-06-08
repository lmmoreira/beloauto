import { Injectable } from '@nestjs/common';
import { ServiceQueryService } from '../../../booking/application/services/service-query.service';
import {
  INotificationBookingPort,
  NotificationServiceInfo,
} from '../../application/ports/notification-booking.port';

@Injectable()
export class NotificationBookingAdapter implements INotificationBookingPort {
  constructor(private readonly serviceQueryService: ServiceQueryService) {}

  async findServicesByIds(
    tenantId: string,
    serviceIds: string[],
  ): Promise<NotificationServiceInfo[]> {
    if (serviceIds.length === 0) return [];
    const services = await this.serviceQueryService.findByIds(serviceIds, tenantId);
    return services.map((s) => ({ serviceId: s.id, serviceName: s.name }));
  }
}
