import { Global, Module } from '@nestjs/common';
import { EVENT_BUS } from '../ports/event-bus.port';
import { LocalEventBusAdapter } from './local-event-bus.adapter';

// @Global makes EVENT_BUS injectable in every context module without an explicit import.
// This module is imported once in AppModule. Replace LocalEventBusAdapter with the real
// GCP Pub/Sub adapter in M15 — no changes to context modules required.
@Global()
@Module({
  providers: [{ provide: EVENT_BUS, useClass: LocalEventBusAdapter }],
  exports: [EVENT_BUS],
})
export class EventBusModule {}
