import { BookingLineInput } from '../../../contexts/booking/domain/booking-line.entity';
import { Money } from '../../../shared/value-objects/money';
import { uuidv7 } from '../../../shared/domain/uuid-v7';

export class BookingLineInputBuilder {
  private serviceId = uuidv7();
  private serviceNameAtBooking = 'Lavagem Simples';
  private priceAtBooking = Money.from(100, 'BRL');
  private durationMinsAtBooking = 30;
  private pointsValueAtBooking = 5;
  private requiresPickupAddressAtBooking = false;

  withServiceId(serviceId: string): this {
    this.serviceId = serviceId;
    return this;
  }

  withServiceNameAtBooking(name: string): this {
    this.serviceNameAtBooking = name;
    return this;
  }

  withPriceAtBooking(price: Money): this {
    this.priceAtBooking = price;
    return this;
  }

  withDurationMinsAtBooking(mins: number): this {
    this.durationMinsAtBooking = mins;
    return this;
  }

  withPointsValueAtBooking(points: number): this {
    this.pointsValueAtBooking = points;
    return this;
  }

  withRequiresPickupAddressAtBooking(v: boolean): this {
    this.requiresPickupAddressAtBooking = v;
    return this;
  }

  build(): BookingLineInput {
    return {
      serviceId: this.serviceId,
      serviceNameAtBooking: this.serviceNameAtBooking,
      priceAtBooking: this.priceAtBooking,
      durationMinsAtBooking: this.durationMinsAtBooking,
      pointsValueAtBooking: this.pointsValueAtBooking,
      requiresPickupAddressAtBooking: this.requiresPickupAddressAtBooking,
    };
  }
}
