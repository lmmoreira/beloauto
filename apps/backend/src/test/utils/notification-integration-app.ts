import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventBusModule } from '../../shared/infrastructure/event-bus.module';
import { TransactionManagerModule } from '../../shared/infrastructure/transaction-manager.module';
import { HotsiteConfigEntity } from '../../contexts/platform/infrastructure/entities/hotsite-config.entity';
import { TenantEntity } from '../../contexts/platform/infrastructure/entities/tenant.entity';
import { PlatformModule } from '../../contexts/platform/platform.module';
import { StaffEntity } from '../../contexts/staff/infrastructure/entities/staff.entity';
import { StaffModule } from '../../contexts/staff/staff.module';
import { NOTIFICATION_DISPATCHER } from '../../contexts/notification/application/ports/notification-dispatcher.port';
import { NotificationLogEntity } from '../../contexts/notification/infrastructure/entities/notification-log.entity';
import { NotificationModule } from '../../contexts/notification/notification.module';
import { InMemoryNotificationDispatcher } from '../infrastructure/in-memory-notification-dispatcher';
import { EVENT_BUS, IEventBus } from '../../shared/ports/event-bus.port';

export interface NotificationIntegrationAppOptions {
  dispatcher: InMemoryNotificationDispatcher;
  configure?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

export async function createNotificationIntegrationApp(
  options: NotificationIntegrationAppOptions,
): Promise<{ app: INestApplication; ds: DataSource; eventBus: IEventBus }> {
  const { dispatcher, configure } = options;

  let builder: TestingModuleBuilder = Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({
        type: 'postgres',
        url: process.env['TEST_DATABASE_URL'],
        entities: [TenantEntity, HotsiteConfigEntity, StaffEntity, NotificationLogEntity],
        synchronize: false,
      }),
      EventBusModule,
      TransactionManagerModule,
      PlatformModule,
      StaffModule,
      NotificationModule,
    ],
  })
    .overrideProvider(NOTIFICATION_DISPATCHER)
    .useValue(dispatcher);

  if (configure) {
    builder = configure(builder);
  }

  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, ds: moduleRef.get(DataSource), eventBus: moduleRef.get<IEventBus>(EVENT_BUS) };
}
