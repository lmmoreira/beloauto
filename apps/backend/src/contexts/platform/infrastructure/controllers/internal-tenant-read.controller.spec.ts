import { HttpException, HttpStatus } from '@nestjs/common';
import { TenantNotFoundError } from '../../domain/errors/platform-domain.error';
import { GetTenantByIdUseCase } from '../../application/use-cases/get-tenant-by-id.use-case';
import { InternalTenantReadController } from './internal-tenant-read.controller';

describe('InternalTenantReadController', () => {
  let useCase: jest.Mocked<GetTenantByIdUseCase>;
  let controller: InternalTenantReadController;

  beforeEach(() => {
    useCase = { execute: jest.fn() } as unknown as jest.Mocked<GetTenantByIdUseCase>;
    controller = new InternalTenantReadController(useCase);
  });

  it('returns the TenantInfoDto from the use case', async () => {
    const dto = { id: 'tid-1', slug: 'lavacar-bh', name: 'Lavacar BH' };
    useCase.execute.mockResolvedValue(dto);

    const result = await controller.getTenant('tid-1');

    expect(useCase.execute).toHaveBeenCalledWith('tid-1');
    expect(result).toBe(dto);
  });

  it('maps TenantNotFoundError to 404 via mapPlatformError', async () => {
    useCase.execute.mockRejectedValue(new TenantNotFoundError('tid-1'));

    const err = await controller.getTenant('tid-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.NOT_FOUND);
  });
});
