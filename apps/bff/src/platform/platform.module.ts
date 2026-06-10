import { Module } from '@nestjs/common';
import { BackendHttpModule } from '../shared/http/backend-http.module';
import { HotsiteAdminController } from './hotsite-admin.controller';
import { PlatformPublicController } from './platform.public.controller';

@Module({
  imports: [BackendHttpModule],
  controllers: [PlatformPublicController, HotsiteAdminController],
})
export class PlatformModule {}
