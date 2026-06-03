import { Inject, Injectable } from '@nestjs/common';
import { AppLogger } from '../../../../shared/observability/app-logger';
import { DELIVERY_CHANNEL, IDeliveryChannel } from '../../application/ports/delivery-channel.port';
import {
  INotificationDispatcher,
  OutboundMessage,
} from '../../application/ports/notification-dispatcher.port';

@Injectable()
export class NotificationDispatcherAdapter implements INotificationDispatcher {
  private readonly logger = new AppLogger(NotificationDispatcherAdapter.name);

  constructor(
    @Inject(DELIVERY_CHANNEL)
    private readonly channels: IDeliveryChannel[],
  ) {}

  async dispatch(message: OutboundMessage): Promise<void> {
    const adapter = this.channels.find((c) => c.channelType === message.channel);
    if (!adapter) {
      this.logger.warn(`No adapter for channel ${message.channel} — skipping`, {
        tenantId: message.tenantId,
        to: message.to,
      });
      return;
    }
    await adapter.send(message);
  }
}
