import { Module } from '@nestjs/common';
import { BackendHttpModule } from '../shared/http/backend-http.module';
import { HotsiteAdminController } from './hotsite-admin.controller';
import { TenantsController } from './tenants.controller';

@Module({
  imports: [BackendHttpModule],
  controllers: [TenantsController, HotsiteAdminController],
})
export class TenantsModule {}
