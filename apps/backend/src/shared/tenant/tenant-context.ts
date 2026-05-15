import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';

interface TenantStore {
  tenantId: string;
  correlationId: string;
}

const tenantStorage = new AsyncLocalStorage<TenantStore>();

export function runWithTenantContext<T>(tenantId: string, correlationId: string, fn: () => T): T {
  return tenantStorage.run({ tenantId, correlationId }, fn);
}

@Injectable()
export class TenantContext {
  get tenantId(): string {
    return tenantStorage.getStore()!.tenantId;
  }

  get correlationId(): string {
    return tenantStorage.getStore()!.correlationId;
  }
}
