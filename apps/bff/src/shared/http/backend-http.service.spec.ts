import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { AxiosResponse } from 'axios';
import { Request } from 'express';
import { BackendHttpService } from './backend-http.service';
import { CurrentUserPayload } from '../decorators/current-user.decorator';

function makeService(
  userOverride?: Partial<CurrentUserPayload>,
  correlationId = 'corr-xyz',
): {
  service: BackendHttpService;
  http: jest.Mocked<Pick<HttpService, 'get' | 'post' | 'patch' | 'delete'>>;
} {
  const http = {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  } as jest.Mocked<Pick<HttpService, 'get' | 'post' | 'patch' | 'delete'>>;

  const user: CurrentUserPayload | undefined = userOverride
    ? {
        sub: 'user-1',
        tenantId: 'tenant-1',
        tenantSlug: 'slug-1',
        role: 'MANAGER',
        ...userOverride,
      }
    : undefined;

  const req = {
    user,
    headers: { 'x-correlation-id': correlationId },
  } as unknown as Request;

  process.env['BACKEND_INTERNAL_URL'] = 'http://backend:3001';
  const service = new BackendHttpService(http as unknown as HttpService, req);
  return { service, http };
}

function axiosOf<T>(data: T) {
  return of({ data } as AxiosResponse<T>);
}

describe('BackendHttpService', () => {
  describe('get()', () => {
    it('calls HttpService.get with correct URL, tenant and correlation headers', async () => {
      const { service, http } = makeService({ tenantId: 'tenant-abc' });
      http.get.mockReturnValue(axiosOf({ ok: true }));

      const result = await service.get('/health');

      expect(http.get).toHaveBeenCalledWith(
        'http://backend:3001/health',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Tenant-ID': 'tenant-abc',
            'X-Correlation-ID': 'corr-xyz',
          }),
          timeout: 10_000,
        }),
      );
      expect(result).toEqual({ ok: true });
    });

    it('forwards query params when provided', async () => {
      const { service, http } = makeService();
      http.get.mockReturnValue(axiosOf([]));

      await service.get('/customers', { page: 1 });

      expect(http.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ params: { page: 1 } }),
      );
    });
  });

  describe('post()', () => {
    it('calls HttpService.post with body and correct headers', async () => {
      const { service, http } = makeService({ tenantId: 'tenant-post' });
      http.post.mockReturnValue(axiosOf({ id: 'new-id' }));

      const result = await service.post('/bookings', { serviceId: 's1' });

      expect(http.post).toHaveBeenCalledWith(
        'http://backend:3001/bookings',
        { serviceId: 's1' },
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Tenant-ID': 'tenant-post' }),
        }),
      );
      expect(result).toEqual({ id: 'new-id' });
    });
  });

  describe('patch()', () => {
    it('calls HttpService.patch with correct URL and headers', async () => {
      const { service, http } = makeService({}, 'corr-patch');
      http.patch.mockReturnValue(axiosOf({ updated: true }));

      await service.patch('/bookings/b1/status', { status: 'APPROVED' });

      expect(http.patch).toHaveBeenCalledWith(
        'http://backend:3001/bookings/b1/status',
        { status: 'APPROVED' },
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Correlation-ID': 'corr-patch' }),
        }),
      );
    });
  });

  describe('delete()', () => {
    it('calls HttpService.delete with correct URL and headers', async () => {
      const { service, http } = makeService({ tenantId: 'tenant-del' });
      http.delete.mockReturnValue(axiosOf(undefined));

      await service.delete('/bookings/b1');

      expect(http.delete).toHaveBeenCalledWith(
        'http://backend:3001/bookings/b1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Tenant-ID': 'tenant-del' }),
        }),
      );
    });
  });

  describe('headers()', () => {
    it('uses empty string for X-Tenant-ID when no authenticated user', async () => {
      const { service, http } = makeService(undefined);
      http.get.mockReturnValue(axiosOf({}));

      await service.get('/public');

      expect(http.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Tenant-ID': '' }),
        }),
      );
    });

    it('uses empty string for X-Correlation-ID when header is absent', async () => {
      const http = { get: jest.fn() } as jest.Mocked<Pick<HttpService, 'get'>>;
      const req = { user: undefined, headers: {} } as unknown as Request;
      process.env['BACKEND_INTERNAL_URL'] = 'http://backend:3001';
      const service = new BackendHttpService(http as unknown as HttpService, req);
      http.get.mockReturnValue(axiosOf({}));

      await service.get('/public');

      expect(http.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Correlation-ID': '' }),
        }),
      );
    });
  });
});
