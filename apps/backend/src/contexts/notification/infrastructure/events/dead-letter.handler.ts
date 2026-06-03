import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from '../../../../shared/domain/domain-event';
import { AppLogger } from '../../../../shared/observability/app-logger';
import { EVENT_BUS, IEventBus } from '../../../../shared/ports/event-bus.port';

@Injectable()
export class DeadLetterHandler implements OnModuleInit {
  private readonly logger = new AppLogger(DeadLetterHandler.name);

  constructor(@Inject(EVENT_BUS) private readonly eventBus: IEventBus) {}

  onModuleInit(): void {
    this.eventBus.subscribe<DomainEvent>('dead-letter', (event) => this.handle(event), 'monitor');
  }

  async handle(event: DomainEvent): Promise<void> {
    this.logger.error('Dead-letter message received — requires human investigation', undefined, {
      eventId: event.eventId,
      eventName: event.eventName,
      tenantId: event.tenantId,
      deliveryAttempt: (event as unknown as Record<string, unknown>)['deliveryAttempt'],
      deadLetterReason: (event as unknown as Record<string, unknown>)['deadLetterReason'],
    });
    // Does NOT throw — adapter must ACK to prevent infinite DLQ redelivery
  }
}
