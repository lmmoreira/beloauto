import {
  BookingLine,
  BookingLineProps,
} from '../../../contexts/booking/domain/booking-line.entity';
import { Money } from '../../../shared/value-objects/money';
import { uuidv7 } from '../../../shared/domain/uuid-v7';

export class BookingLineBuilder {
  private lineId = uuidv7();
  private bookingId = uuidv7();
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private serviceId = uuidv7();
  private serviceNameAtBooking = 'Lavagem Simples';
  private priceAtBooking = Money.from(100, 'BRL');
  private durationMinsAtBooking = 30;
  private pointsValueAtBooking = 5;
  private requiresPickupAddressAtBooking = false;
  private actualPriceCharged: Money | null = null;

  withLineId(lineId: string): this {
    this.lineId = lineId;
    return this;
  }
  withBookingId(bookingId: string): this {
    this.bookingId = bookingId;
    return this;
  }
  withTenantId(tenantId: string): this {
    this.tenantId = tenantId;
    return this;
  }
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
  withActualPriceCharged(price: Money | null): this {
    this.actualPriceCharged = price;
    return this;
  }

  build(): BookingLine {
    const props: BookingLineProps = {
      lineId: this.lineId,
      bookingId: this.bookingId,
      tenantId: this.tenantId,
      serviceId: this.serviceId,
      serviceNameAtBooking: this.serviceNameAtBooking,
      priceAtBooking: this.priceAtBooking,
      durationMinsAtBooking: this.durationMinsAtBooking,
      pointsValueAtBooking: this.pointsValueAtBooking,
      requiresPickupAddressAtBooking: this.requiresPickupAddressAtBooking,
      actualPriceCharged: this.actualPriceCharged,
    };
    return BookingLine.reconstitute(props);
  }
}
