import { uuidv7 } from '../../../shared/domain/uuid-v7';
import { BookingEntity } from '../../../contexts/booking/infrastructure/entities/booking.entity';

export class BookingEntityBuilder {
  private id = uuidv7();
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private status = 'PENDING';
  private type = 'GUEST';
  private customerId: string | null = null;
  private guestEmail = 'guest@example.com';
  private guestName = 'João Silva';
  private guestPhone = '31999999999';
  private guestAddress: Record<string, unknown> | null = null;
  private pickupAddress: Record<string, unknown> | null = null;
  private scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  private totalDurationMins = 30;
  private totalPriceAmount = '100.00';
  private totalActualPriceAmount: string | null = null;
  private beforeServicePhotoUrls: string[] = [];
  private afterServicePhotoUrls: string[] = [];
  private adminNotes: string | null = null;
  private infoRequestMessage: string | null = null;
  private infoRequestedAt: Date | null = null;
  private infoRequestedBy: string | null = null;
  private infoResponseMessage: string | null = null;
  private infoSubmittedAt: Date | null = null;
  private approvedAt: Date | null = null;
  private approvedBy: string | null = null;
  private completedAt: Date | null = null;
  private completedBy: string | null = null;
  private cancelledAt: Date | null = null;
  private cancelledBy: string | null = null;
  private cancellationReason: string | null = null;
  private rejectedAt: Date | null = null;
  private rejectedBy: string | null = null;
  private rejectionReason: string | null = null;
  private createdAt = new Date();
  private updatedAt = new Date();

  withId(id: string): this {
    this.id = id;
    return this;
  }
  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }
  withStatus(status: string): this {
    this.status = status;
    return this;
  }
  withType(type: string): this {
    this.type = type;
    return this;
  }
  withCustomerId(customerId: string | null): this {
    this.customerId = customerId;
    return this;
  }
  withGuestEmail(email: string): this {
    this.guestEmail = email;
    return this;
  }
  withGuestName(name: string): this {
    this.guestName = name;
    return this;
  }
  withGuestPhone(phone: string): this {
    this.guestPhone = phone;
    return this;
  }
  withGuestAddress(address: Record<string, unknown> | null): this {
    this.guestAddress = address;
    return this;
  }
  withPickupAddress(address: Record<string, unknown> | null): this {
    this.pickupAddress = address;
    return this;
  }
  withScheduledAt(date: Date): this {
    this.scheduledAt = date;
    return this;
  }
  withTotalDurationMins(mins: number): this {
    this.totalDurationMins = mins;
    return this;
  }
  withTotalPriceAmount(amount: string): this {
    this.totalPriceAmount = amount;
    return this;
  }

  build(): BookingEntity {
    const entity = new BookingEntity();
    entity.id = this.id;
    entity.tenantId = this.tenantId;
    entity.status = this.status;
    entity.type = this.type;
    entity.customerId = this.customerId;
    entity.guestEmail = this.guestEmail;
    entity.guestName = this.guestName;
    entity.guestPhone = this.guestPhone;
    entity.guestAddress = this.guestAddress;
    entity.pickupAddress = this.pickupAddress;
    entity.scheduledAt = this.scheduledAt;
    entity.totalDurationMins = this.totalDurationMins;
    entity.totalPriceAmount = this.totalPriceAmount;
    entity.totalActualPriceAmount = this.totalActualPriceAmount;
    entity.beforeServicePhotoUrls = this.beforeServicePhotoUrls;
    entity.afterServicePhotoUrls = this.afterServicePhotoUrls;
    entity.adminNotes = this.adminNotes;
    entity.infoRequestMessage = this.infoRequestMessage;
    entity.infoRequestedAt = this.infoRequestedAt;
    entity.infoRequestedBy = this.infoRequestedBy;
    entity.infoResponseMessage = this.infoResponseMessage;
    entity.infoSubmittedAt = this.infoSubmittedAt;
    entity.approvedAt = this.approvedAt;
    entity.approvedBy = this.approvedBy;
    entity.completedAt = this.completedAt;
    entity.completedBy = this.completedBy;
    entity.cancelledAt = this.cancelledAt;
    entity.cancelledBy = this.cancelledBy;
    entity.cancellationReason = this.cancellationReason;
    entity.rejectedAt = this.rejectedAt;
    entity.rejectedBy = this.rejectedBy;
    entity.rejectionReason = this.rejectionReason;
    entity.createdAt = this.createdAt;
    entity.updatedAt = this.updatedAt;
    return entity;
  }
}
