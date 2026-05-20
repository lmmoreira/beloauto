import { Injectable, LoggerService, LogLevel } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';

interface LogContext {
  tenantId?: string;
  userId?: string;
  correlationId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

@Injectable()
export class AppLogger implements LoggerService {
  private context?: string;

  constructor(
    context?: string,
    private readonly tenantContext?: TenantContext,
  ) {
    this.context = context;
  }

  log(message: string, context?: LogContext | string): void {
    this.write('INFO', message, context);
  }

  warn(message: string, context?: LogContext | string): void {
    this.write('WARN', message, context);
  }

  error(message: string, trace?: string, context?: LogContext | string): void {
    this.write('ERROR', message, context, trace);
  }

  debug(message: string, context?: LogContext | string): void {
    this.write('DEBUG', message, context);
  }

  verbose(message: string, context?: LogContext | string): void {
    this.write('VERBOSE', message, context);
  }

  setLogLevels(_levels: LogLevel[]): void {
    // Log level filtering delegated to log aggregator (Loki)
  }

  private write(
    level: string,
    message: string,
    context?: LogContext | string,
    trace?: string,
  ): void {
    const ctx = typeof context === 'string' ? { context } : context;

    // Auto-enrich with request-scoped tenant context when available
    let tenantFields: Partial<LogContext> = {};
    try {
      if (this.tenantContext) {
        tenantFields = {
          tenantId: this.tenantContext.tenantId,
          correlationId: this.tenantContext.correlationId,
        };
      }
    } catch {
      // tenantStorage.getStore() returns undefined outside a request — safe to ignore
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      service: 'backend',
      context: (typeof context === 'string' ? context : undefined) ?? this.context,
      message,
      ...tenantFields,
      ...(ctx && typeof ctx === 'object' ? ctx : {}),
      ...(trace ? { trace } : {}),
    };
    process.stdout.write(JSON.stringify(entry) + '\n');
  }
}
