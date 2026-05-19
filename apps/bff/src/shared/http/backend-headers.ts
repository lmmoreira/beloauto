import { Request } from 'express';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

export function buildBackendHeaders(req: Request): Record<string, string> {
  const user = req.user as CurrentUserPayload | undefined;
  const correlationId = req.headers['x-correlation-id'] as string | undefined;

  const headers: Record<string, string> = {
    'X-Tenant-ID': user?.tenantId ?? '',
    'X-Correlation-ID': correlationId ?? '',
  };

  if (user?.sub) {
    headers['X-Actor-ID'] = user.sub;
    headers['X-Actor-Type'] = user.role === 'CUSTOMER' ? 'CUSTOMER' : 'STAFF';
    headers['X-Actor-Role'] = user.role;
  }

  return headers;
}
