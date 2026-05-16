import { DomainEvent } from '../../shared/domain/domain-event';
import { IEventBus } from '../../shared/ports/event-bus.port';

export class InMemoryEventBus implements IEventBus {
  readonly published: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }

  clear(): void {
    this.published.length = 0;
  }
}
