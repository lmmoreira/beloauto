import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  getAuthenticateOptions(context: ExecutionContext): object {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.query['type'] === 'staff') return { state: '__staff__' };
    const tenantSlug = req.query['tenantSlug'] as string | undefined;
    return { state: tenantSlug ?? '' };
  }
}
