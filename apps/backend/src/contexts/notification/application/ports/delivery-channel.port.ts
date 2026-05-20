import { OutboundMessage } from './notification-dispatcher.port';

export type DeliveryChannelType = 'EMAIL' | 'WHATSAPP' | 'SMS';

export const DELIVERY_CHANNEL = Symbol('IDeliveryChannel');

export interface IDeliveryChannel {
  readonly channelType: DeliveryChannelType;
  send(message: OutboundMessage): Promise<void>;
}
