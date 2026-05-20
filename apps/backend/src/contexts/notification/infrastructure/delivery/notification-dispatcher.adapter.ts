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
    await Promise.all(
      this.channels.map((channel) =>
        channel.send(message).catch((err: unknown) => {
          this.logger.error(
            `Delivery channel ${channel.channelType} failed`,
            err instanceof Error ? err.stack : String(err),
            { tenantId: message.tenantId, to: message.to },
          );
          throw err;
        }),
      ),
    );
  }
}
