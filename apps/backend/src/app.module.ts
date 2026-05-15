import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from './contexts/platform/platform.module';
import { HealthController } from './health/health.controller';
import { NoopEventBusAdapter } from './shared/infrastructure/noop-event-bus.adapter';
import { EVENT_BUS } from './shared/ports/index';
import { TenantInterceptor } from './shared/tenant/tenant.interceptor';
import { TenantModule } from './shared/tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env['DATABASE_URL'],
      synchronize: false,
      migrationsRun: false,
      entities: [__dirname + '/contexts/**/infrastructure/entities/*.entity{.ts,.js}'],
    }),
    TenantModule,
    PlatformModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: EVENT_BUS, useClass: NoopEventBusAdapter },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class AppModule {}
