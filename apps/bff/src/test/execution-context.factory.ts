import { ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

interface ExecutionContextOptions {
  user?: unknown;
  headers?: Record<string, string>;
  query?: Record<string, string | undefined>;
  path?: string;
  method?: string;
}

export function makeExecutionContext(options: ExecutionContextOptions = {}): ExecutionContext {
  const { user, headers = {}, query = {}, path = '/', method = 'GET' } = options;
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user, headers, query, path, method }),
    }),
  } as unknown as ExecutionContext;
}

interface RequestOptions {
  user?: unknown;
  headers?: Record<string, string>;
}

export function makeRequest(options: RequestOptions = {}): Request {
  const { user, headers = {} } = options;
  return { user, headers } as Request;
}
