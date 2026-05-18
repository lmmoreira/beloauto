import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { firstValueFrom } from 'rxjs';
import { Request } from 'express';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

@Injectable({ scope: Scope.REQUEST })
export class BackendHttpService {
  private readonly baseUrl = process.env['BACKEND_INTERNAL_URL'] ?? '';

  constructor(
    private readonly http: HttpService,
    @Inject(REQUEST) private readonly req: Request,
  ) {}

  async get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await firstValueFrom(
      this.http.get<T>(`${this.baseUrl}${path}`, {
        headers: this.headers(),
        params,
        timeout: 10_000,
      }),
    );
    return data;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const { data } = await firstValueFrom(
      this.http.post<T>(`${this.baseUrl}${path}`, body, {
        headers: this.headers(),
        timeout: 10_000,
      }),
    );
    return data;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const { data } = await firstValueFrom(
      this.http.patch<T>(`${this.baseUrl}${path}`, body, {
        headers: this.headers(),
        timeout: 10_000,
      }),
    );
    return data;
  }

  async delete<T>(path: string): Promise<T> {
    const { data } = await firstValueFrom(
      this.http.delete<T>(`${this.baseUrl}${path}`, {
        headers: this.headers(),
        timeout: 10_000,
      }),
    );
    return data;
  }

  private headers(): Record<string, string> {
    const user = this.req.user as CurrentUserPayload | undefined;
    const correlationId = this.req.headers['x-correlation-id'] as string | undefined;
    return {
      'X-Tenant-ID': user?.tenantId ?? '',
      'X-Correlation-ID': correlationId ?? '',
    };
  }
}
