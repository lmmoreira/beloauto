import { Injectable } from '@nestjs/common';
import { DomainEvent } from '../domain/domain-event';
import { AppLogger } from '../observability/app-logger';
import { IEventBus } from '../ports/event-bus.port';

@Injectable()
export class LocalEventBusAdapter implements IEventBus {
  private readonly logger = new AppLogger(LocalEventBusAdapter.name);
  private readonly subscribers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  async publish(event: DomainEvent): Promise<void> {
    this.logger.debug(`[local] event published: ${event.eventName}`, {
      tenantId: event.tenantId,
      eventId: event.eventId,
      correlationId: event.correlationId,
    });
    const handlers = this.subscribers.get(event.eventName) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(
          `[local] handler failed for ${event.eventName}`,
          err instanceof Error ? err.stack : String(err),
          { tenantId: event.tenantId, eventId: event.eventId },
        );
      }
    }
  }

  subscribe<T extends DomainEvent>(eventName: string, handler: (event: T) => Promise<void>): void {
    const existing = this.subscribers.get(eventName) ?? [];
    this.subscribers.set(eventName, [
      ...existing,
      handler as (event: DomainEvent) => Promise<void>,
    ]);
  }
}
