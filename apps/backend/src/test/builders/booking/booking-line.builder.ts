import {
  BookingLine,
  BookingLineProps,
} from '../../../contexts/booking/domain/booking-line.entity';
import { Money } from '../../../shared/value-objects/money';
import { uuidv7 } from '../../../shared/domain/uuid-v7';
import { BookingLineInputBuilder } from './booking-line-input.builder';

export class BookingLineBuilder {
  private lineId = uuidv7();
  private bookingId = uuidv7();
  private tenantId = '00000000-0000-7000-8000-000000000001';
  private readonly actualPriceCharged: Money | null = null;
  private readonly inputBuilder = new BookingLineInputBuilder();

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
    this.inputBuilder.withServiceId(serviceId);
    return this;
  }

  withServiceNameAtBooking(name: string): this {
    this.inputBuilder.withServiceNameAtBooking(name);
    return this;
  }

  withPriceAtBooking(price: Money): this {
    this.inputBuilder.withPriceAtBooking(price);
    return this;
  }

  withDurationMinsAtBooking(mins: number): this {
    this.inputBuilder.withDurationMinsAtBooking(mins);
    return this;
  }

  withPointsValueAtBooking(points: number): this {
    this.inputBuilder.withPointsValueAtBooking(points);
    return this;
  }

  withRequiresPickupAddressAtBooking(v: boolean): this {
    this.inputBuilder.withRequiresPickupAddressAtBooking(v);
    return this;
  }

  build(): BookingLine {
    const input = this.inputBuilder.build();
    const props: BookingLineProps = {
      lineId: this.lineId,
      bookingId: this.bookingId,
      tenantId: this.tenantId,
      serviceId: input.serviceId,
      serviceNameAtBooking: input.serviceNameAtBooking,
      priceAtBooking: input.priceAtBooking,
      durationMinsAtBooking: input.durationMinsAtBooking,
      pointsValueAtBooking: input.pointsValueAtBooking,
      requiresPickupAddressAtBooking: input.requiresPickupAddressAtBooking,
      actualPriceCharged: this.actualPriceCharged,
    };
    return BookingLine.reconstitute(props);
  }
}
