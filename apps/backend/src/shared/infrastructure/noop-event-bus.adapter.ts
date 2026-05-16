import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../domain/domain-event';
import { IEventBus } from '../ports/event-bus.port';
import { AppLogger } from '../observability/app-logger';

@Injectable()
export class NoopEventBusAdapter implements IEventBus {
  private readonly logger = new AppLogger(NoopEventBusAdapter.name);

  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`[noop] event published: ${event.eventName}`, {
      tenantId: event.tenantId,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });
  }
}
