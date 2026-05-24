import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { IBookingAvailabilityPort } from '../../application/ports/booking-availability.port';
import { BookedSlot } from '../../domain/booked-slot';
import { BookingStatus } from '../../domain/booking.aggregate';
import { BookingEntity } from '../entities/booking.entity';

@Injectable()
export class TypeOrmBookingAvailabilityAdapter implements IBookingAvailabilityPort {
  constructor(
    @InjectRepository(BookingEntity)
    private readonly repo: Repository<BookingEntity>,
  ) {}

  async findApprovedByTenantAndDate(tenantId: string, date: string): Promise<BookedSlot[]> {
    return this.queryApproved(tenantId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`);
  }

  async findApprovedByTenantAndDateRange(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<BookedSlot[]> {
    return this.queryApproved(tenantId, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`);
  }

  private async queryApproved(
    tenantId: string,
    isoStart: string,
    isoEnd: string,
  ): Promise<BookedSlot[]> {
    const entities = await this.repo.find({
      where: {
        tenantId,
        status: BookingStatus.APPROVED,
        scheduledAt: Between(new Date(isoStart), new Date(isoEnd)),
      },
      select: ['scheduledAt', 'totalDurationMins'],
    });
    return entities.map((e) => ({
      scheduledAt: e.scheduledAt,
      totalDurationMins: e.totalDurationMins,
    }));
  }
}
