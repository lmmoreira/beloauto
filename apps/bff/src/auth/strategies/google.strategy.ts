import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { Profile, Strategy } from 'passport-google-oauth20';

export interface GoogleProfile {
  googleOAuthId: string;
  email: string;
  name: string;
  tenantSlug?: string;
  loginType?: 'staff';
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env['GOOGLE_CLIENT_ID'] ?? '',
      clientSecret: process.env['GOOGLE_CLIENT_SECRET'] ?? '',
      callbackURL: process.env['GOOGLE_CALLBACK_URL'] ?? '',
      scope: ['email', 'profile'],
      passReqToCallback: true,
    });
  }

  validate(
    req: Request,
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: (error: Error | null, user?: GoogleProfile) => void,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error('Google account did not provide an email address'));
      return;
    }
    const state = (req.query['state'] as string) || '';
    // '__staff__' cannot be a valid tenant slug ([a-z0-9-]+ only), so there is no collision
    const loginType = state === '__staff__' ? ('staff' as const) : undefined;
    const tenantSlug = loginType ? undefined : state || undefined;
    done(null, {
      googleOAuthId: profile.id,
      email,
      name: profile.displayName,
      tenantSlug,
      loginType,
    });
  }
}
