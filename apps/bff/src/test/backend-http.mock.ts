import { BackendHttpService } from '../shared/http/backend-http.service';

export function makeBackendHttp(
  overrides?: Partial<jest.Mocked<BackendHttpService>>,
): jest.Mocked<BackendHttpService> {
  return {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
    getForPublic: jest.fn(),
    ...overrides,
  } as jest.Mocked<BackendHttpService>;
}
