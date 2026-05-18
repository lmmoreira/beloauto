import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ManagerRoleGuard implements CanActivate {
  // Guards execute before interceptors in NestJS, so TenantContext (AsyncLocalStorage)
  // is not populated yet. Read X-Actor-Role directly from the request header.
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const actorRole = req.headers['x-actor-role'];

    if (actorRole !== 'MANAGER') {
      throw new HttpException(
        {
          type: 'about:blank',
          title: 'Forbidden',
          status: HttpStatus.FORBIDDEN,
          detail: 'MANAGER role required',
        },
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
