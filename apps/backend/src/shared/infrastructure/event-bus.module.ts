import { Global, Module } from '@nestjs/common';
import { EVENT_BUS } from '../ports/event-bus.port';
import { NoopEventBusAdapter } from './noop-event-bus.adapter';

@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: NoopEventBusAdapter }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
