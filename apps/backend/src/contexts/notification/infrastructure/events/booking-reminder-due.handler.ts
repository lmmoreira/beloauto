import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '../../../../shared/observability/app-logger';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';
import { BookingReminderDue } from '../../../booking/domain/events/booking-reminder-due.event';
import { SendBookingReminderDueNotificationUseCase } from '../../application/use-cases/send-booking-reminder-due-notification/send-booking-reminder-due-notification.use-case';

@Injectable()
export class BookingReminderDueHandler implements OnModuleInit {
  private readonly logger = new AppLogger(BookingReminderDueHandler.name);

  constructor(
    private readonly sendBookingReminderDueNotification: SendBookingReminderDueNotificationUseCase,
    @Inject(EVENT_BUS) private readonly eventBus: IEventBus,
  ) {}

  onModuleInit(): void {
    this.eventBus.subscribe<BookingReminderDue>(
      'BookingReminderDue',
      (event) => this.handle(event),
      'notification',
    );
  }

  async handle(event: BookingReminderDue): Promise<void> {
    this.logger.log('BookingReminderDue received', {
      tenantId: event.tenantId,
      correlationId: event.correlationId,
      bookingId: event.data.bookingId,
      recipientEmail: event.data.recipientEmail,
    });
    try {
      await this.sendBookingReminderDueNotification.execute({
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
        'BookingReminderDueHandler failed — will nack for retry',
        err instanceof Error ? err.stack : String(err),
        { tenantId: event.tenantId, correlationId: event.correlationId },
      );
      throw err;
    }
  }
}
