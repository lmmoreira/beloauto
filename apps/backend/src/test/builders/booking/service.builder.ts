import { Service } from '../../../contexts/booking/domain/service.aggregate';
import { Money } from '../../../shared/value-objects/money';
import { uuidv7 } from '../../../shared/domain/uuid-v7';

export class ServiceBuilder {
  private readonly id = uuidv7();
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private name = 'Lavagem Simples';
  private price = Money.from(100, 'BRL');
  private durationMinutes = 30;
  private loyaltyPointsValue = 5;
  private requiresPickupAddress = false;
  private description: string | undefined = undefined;
  private isActive = true;

  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }

  withName(name: string): this {
    this.name = name;
    return this;
  }

  withPrice(price: Money): this {
    this.price = price;
    return this;
  }

  withDurationMinutes(durationMinutes: number): this {
    this.durationMinutes = durationMinutes;
    return this;
  }

  withLoyaltyPointsValue(loyaltyPointsValue: number): this {
    this.loyaltyPointsValue = loyaltyPointsValue;
    return this;
  }

  withRequiresPickupAddress(requiresPickupAddress: boolean): this {
    this.requiresPickupAddress = requiresPickupAddress;
    return this;
  }

  withDescription(description: string): this {
    this.description = description;
    return this;
  }

  withIsActive(isActive: boolean): this {
    this.isActive = isActive;
    return this;
  }

  build(): Service {
    return Service.reconstitute({
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      price: this.price,
      durationMinutes: this.durationMinutes,
      loyaltyPointsValue: this.loyaltyPointsValue,
      requiresPickupAddress: this.requiresPickupAddress,
      description: this.description ?? null,
      isActive: this.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
