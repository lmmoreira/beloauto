import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { Public } from '../shared/decorators/public.decorator';
import { GoogleProfile } from './strategies/google.strategy';

@Controller('auth')
export class AuthController {
  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google')
  login(): void {
    // Passport redirects to Google — response handled by the strategy
  }

  @Public()
  @UseGuards(AuthGuard('google'))
  @Get('google/callback')
  handleGoogleCallback(@Req() req: Request): GoogleProfile {
    // GoogleStrategy.validate() populates req.user with the Google profile.
    // JWT issuance and redirect logic are added in M03-S04/S06/S07.
    return req.user as GoogleProfile;
  }
}
