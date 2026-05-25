import { Inject, Injectable } from '@nestjs/common';
import { utcDateToLocalDate } from '../../../../shared/utils/calendar-date';
import { Address } from '../../../../shared/value-objects/address';
import { IEventBus, EVENT_BUS } from '../../../../shared/ports/event-bus.port';
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from '../../../../shared/ports/transaction-manager.port';
import { TenantContext } from '../../../../shared/tenant/tenant-context';
import { Booking } from '../../domain/booking.aggregate';
import { BookingLineInput } from '../../domain/booking-line.entity';
import {
  BookingCustomerNotFoundError,
  BookingServiceNotActiveError,
  BookingServiceNotInTenantError,
  BookingSlotUnavailableError,
  CustomerPhoneNotSetError,
} from '../../domain/errors/booking-domain.error';
import {
  IBookingAvailabilityPort,
  BOOKING_AVAILABILITY_PORT,
} from '../ports/booking-availability.port';
import { IBookingRepository, BOOKING_REPOSITORY } from '../ports/booking-repository.port';
import { ICustomerProfilePort, CUSTOMER_PROFILE_PORT } from '../ports/customer-profile.port';
import {
  IScheduleTenantSettingsPort,
  SCHEDULE_TENANT_SETTINGS_PORT,
} from '../ports/schedule-tenant-settings.port';
import { IServiceRepository, SERVICE_REPOSITORY } from '../ports/service-repository.port';
import { RequestAuthenticatedBookingDto } from '../dtos/request-authenticated-booking.dto';
import { AddressResult, BookingLineResult } from './request-booking.use-case';

export interface RequestAuthenticatedBookingUseCaseResult {
  bookingId: string;
  status: string;
  scheduledAt: string;
  totalPrice: { amount: number; currency: string };
  totalDurationMins: number;
  pickupAddress: AddressResult | null;
  beforeServicePhotoUrls: string[];
  lines: BookingLineResult[];
}

@Injectable()
export class RequestAuthenticatedBookingUseCase {
  constructor(
    @Inject(CUSTOMER_PROFILE_PORT) private readonly customerProfilePort: ICustomerProfilePort,
    @Inject(SERVICE_REPOSITORY) private readonly serviceRepo: IServiceRepository,
    @Inject(BOOKING_AVAILABILITY_PORT)
    private readonly availabilityPort: IBookingAvailabilityPort,
    @Inject(SCHEDULE_TENANT_SETTINGS_PORT)
    private readonly settingsPort: IScheduleTenantSettingsPort,
    @Inject(BOOKING_REPOSITORY) private readonly bookingRepo: IBookingRepository,
    @Inject(TRANSACTION_MANAGER) private readonly txManager: ITransactionManager,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
    private readonly tenantContext: TenantContext,
  ) {}

  async execute(
    dto: RequestAuthenticatedBookingDto,
  ): Promise<RequestAuthenticatedBookingUseCaseResult> {
    const tenantId = this.tenantContext.tenantId;
    const correlationId = this.tenantContext.correlationId;
    const customerId = this.tenantContext.actorId!;

    const customer = await this.customerProfilePort.findById(customerId, tenantId);
    if (!customer) throw new BookingCustomerNotFoundError(customerId);
    if (!customer.phone) throw new CustomerPhoneNotSetError();

    const services = await this.serviceRepo.findByIds(dto.serviceIds, tenantId);
    const serviceMap = new Map(services.map((s) => [s.id, s]));
    const uniqueIds = [...new Set(dto.serviceIds)];
    for (const serviceId of uniqueIds) {
      const service = serviceMap.get(serviceId);
      if (!service) throw new BookingServiceNotInTenantError(serviceId);
      if (!service.isActive) throw new BookingServiceNotActiveError(serviceId);
    }

    const requiresPickup = dto.serviceIds.some((id) => serviceMap.get(id)?.requiresPickupAddress);

    let pickupAddress: Address | undefined;
    if (dto.pickupAddress) {
      pickupAddress = Address.create({
        ...dto.pickupAddress,
        complement: dto.pickupAddress.complement ?? undefined,
      });
    } else if (requiresPickup && customer.defaultAddress) {
      pickupAddress = customer.defaultAddress;
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const totalDurationMins = dto.serviceIds.reduce(
      (sum, id) => sum + (serviceMap.get(id)?.durationMinutes ?? 0),
      0,
    );

    const { businessHours } = await this.settingsPort.getSchedulingSettings(tenantId);
    const localDate = utcDateToLocalDate(scheduledAt, businessHours.timezone);
    const existingSlots = await this.availabilityPort.findApprovedByTenantAndDate(
      tenantId,
      localDate,
    );
    const slotEnd = new Date(scheduledAt.getTime() + totalDurationMins * 60_000);
    const hasOverlap = existingSlots.some((slot) => {
      const existingEnd = new Date(slot.scheduledAt.getTime() + slot.totalDurationMins * 60_000);
      return slot.scheduledAt < slotEnd && scheduledAt < existingEnd;
    });
    if (hasOverlap) throw new BookingSlotUnavailableError();

    const lineInputs: BookingLineInput[] = dto.serviceIds.map((serviceId) => {
      const service = serviceMap.get(serviceId);
      if (!service) throw new BookingServiceNotInTenantError(serviceId);
      return {
        serviceId: service.id,
        serviceNameAtBooking: service.name,
        priceAtBooking: service.price,
        durationMinsAtBooking: service.durationMinutes,
        pointsValueAtBooking: service.loyaltyPointsValue,
        requiresPickupAddressAtBooking: service.requiresPickupAddress,
      };
    });

    const guestAddress = customer.defaultAddress ?? undefined;

    const booking = Booking.requestBooking({
      tenantId,
      guestEmail: customer.email,
      guestName: customer.name,
      guestPhone: customer.phone,
      scheduledAt,
      lineInputs,
      type: 'CUSTOMER',
      correlationId,
      customerId,
      guestAddress,
      pickupAddress,
      beforeServicePhotoUrls: dto.beforeServicePhotoUrls,
    });

    await this.txManager.run(async () => {
      await this.bookingRepo.save(booking);
    });

    for (const event of booking.clearDomainEvents()) {
      await this.eventBus.publish(event);
    }

    return this.toResult(booking);
  }

  private toResult(booking: Booking): RequestAuthenticatedBookingUseCaseResult {
    const pickup = booking.pickupAddress;
    return {
      bookingId: booking.id,
      status: booking.status,
      scheduledAt: booking.scheduledAt.toISOString(),
      totalPrice: {
        amount: booking.totalPrice.amount.toNumber(),
        currency: booking.totalPrice.currency,
      },
      totalDurationMins: booking.totalDurationMins,
      pickupAddress: pickup
        ? {
            street: pickup.street,
            number: pickup.number,
            complement: pickup.complement ?? null,
            neighborhood: pickup.neighborhood,
            city: pickup.city,
            state: pickup.state,
            zipCode: pickup.zipCode,
          }
        : null,
      beforeServicePhotoUrls: booking.beforeServicePhotoUrls ?? [],
      lines: booking.lines.map((l) => ({
        lineId: l.lineId,
        serviceId: l.serviceId,
        priceAtBooking: {
          amount: l.priceAtBooking.amount.toNumber(),
          currency: l.priceAtBooking.currency,
        },
        durationMinsAtBooking: l.durationMinsAtBooking,
        pointsValueAtBooking: l.pointsValueAtBooking,
        requiresPickupAddressAtBooking: l.requiresPickupAddressAtBooking,
      })),
    };
  }
}
