import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

const SLUG_REGEX = /^[a-z0-9-]+$/;

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): object {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.query['type'] === 'staff') {
      const tenantSlug = req.query['tenantSlug'] as string | undefined;
      const validSlug = tenantSlug && SLUG_REGEX.test(tenantSlug) ? tenantSlug : undefined;
      // '__staff__:<slug>' carries tenantSlug for first-login (invite acceptance)
      // '__staff__' alone means regular login (staff already activated)
      return { state: validSlug ? `__staff__:${validSlug}` : '__staff__' };
    }
    const tenantSlug = req.query['tenantSlug'] as string | undefined;
    const validSlug = tenantSlug && SLUG_REGEX.test(tenantSlug) ? tenantSlug : undefined;
    return { state: validSlug ?? '' };
  }
}
