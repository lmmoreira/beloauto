import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { BackendHttpService } from './backend-http.service';

@Module({
  imports: [HttpModule],
  providers: [BackendHttpService],
  exports: [BackendHttpService],
})
export class BackendHttpModule {}
