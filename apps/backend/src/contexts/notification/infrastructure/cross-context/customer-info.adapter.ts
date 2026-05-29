import { Injectable } from '@nestjs/common';
import { CustomerQueryService } from '../../../customer/application/services/customer-query.service';
import {
  INotificationCustomerPort,
  NotificationCustomerInfo,
} from '../../application/ports/notification-customer.port';

@Injectable()
export class CustomerInfoAdapter implements INotificationCustomerPort {
  constructor(private readonly customerQueryService: CustomerQueryService) {}

  async getCustomerInfo(
    customerId: string,
    tenantId: string,
  ): Promise<NotificationCustomerInfo | null> {
    try {
      const customer = await this.customerQueryService.findById(customerId, tenantId);
      if (!customer) return null;
      return { email: customer.email.address, name: customer.name };
    } catch {
      return null;
    }
  }
}
