import {
  INotificationDispatcher,
  OutboundMessage,
} from '../../contexts/notification/application/ports/notification-dispatcher.port';

export class InMemoryNotificationDispatcher implements INotificationDispatcher {
  readonly dispatched: OutboundMessage[] = [];

  async dispatch(message: OutboundMessage): Promise<void> {
    this.dispatched.push(message);
  }

  clear(): void {
    this.dispatched.length = 0;
  }
}
