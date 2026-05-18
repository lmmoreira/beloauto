import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { BackendHttpModule } from '../shared/http/backend-http.module';
import { AuthController } from './auth.controller';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [PassportModule, BackendHttpModule],
  controllers: [AuthController],
  providers: [GoogleStrategy],
})
export class AuthModule {}
