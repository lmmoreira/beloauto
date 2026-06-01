import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../../shared/observability/app-logger';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';
import { BookingReminderDueToday } from '../../../booking/domain/events/booking-reminder-due-today.event';
import { SendBookingReminderDueTodayNotificationUseCase } from '../../application/use-cases/send-booking-reminder-due-today-notification/send-booking-reminder-due-today-notification.use-case';

@Injectable()
export class BookingReminderDueTodayHandler implements OnModuleInit {
  private readonly logger = new AppLogger(BookingReminderDueTodayHandler.name);

  constructor(
    private readonly sendBookingReminderDueTodayNotification: SendBookingReminderDueTodayNotificationUseCase,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<BookingReminderDueToday>(
      'BookingReminderDueToday',
      (event) => this.handle(event),
      'notification',
    );
  }

  async handle(event: BookingReminderDueToday): Promise<void> {
    this.logger.log('BookingReminderDueToday received', {
      tenantId: event.tenantId,
      correlationId: event.correlationId,
      bookingId: event.data.bookingId,
      recipientEmail: event.data.recipientEmail,
    });
    try {
      await this.sendBookingReminderDueTodayNotification.execute({
        tenantId: event.tenantId,
        eventId: event.eventId,
        correlationId: event.correlationId,
        recipientEmail: event.data.recipientEmail,
        customerName: event.data.customerName,
        scheduledAt: event.data.scheduledAt,
        appointmentSlot: event.data.appointmentSlot,
        lines: event.data.lines,
      });
    } catch (err) {
      this.logger.error(
        'BookingReminderDueTodayHandler failed — will nack for retry',
        err instanceof Error ? err.stack : String(err),
        { tenantId: event.tenantId, correlationId: event.correlationId },
      );
      throw err;
    }
  }
}
