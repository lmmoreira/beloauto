import { Module } from '@nestjs/common';
import { BackendHttpModule } from '../shared/http/backend-http.module';
import { ScheduleController } from './schedule.controller';

@Module({
  imports: [BackendHttpModule],
  controllers: [ScheduleController],
})
export class ScheduleModule {}
