import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProvisionTenantUseCase } from '../../application/use-cases/provision-tenant.use-case';
import { PlatformDomainError } from '../../domain/errors/platform-domain.error';
import { InternalTenantController } from './internal-tenant.controller';

const RESULT = { tenantId: 'uuid-1', name: 'Lavacar', slug: 'lavacar' };

describe('InternalTenantController', () => {
  let controller: InternalTenantController;
  let useCase: jest.Mocked<Pick<ProvisionTenantUseCase, 'execute'>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalTenantController],
      providers: [{ provide: ProvisionTenantUseCase, useValue: { execute: jest.fn() } }],
    }).compile();

    controller = moduleRef.get(InternalTenantController);
    useCase = moduleRef.get(ProvisionTenantUseCase);
  });

  it('calls use case and returns the result', async () => {
    (useCase.execute as jest.Mock).mockResolvedValue(RESULT);

    const dto = { name: 'Lavacar', slug: 'lavacar', adminEmail: 'a@a.com' };
    expect(await controller.provision(dto)).toEqual(RESULT);
    expect(useCase.execute).toHaveBeenCalledWith(dto);
  });

  it('maps PlatformDomainError to 400 HttpException', async () => {
    (useCase.execute as jest.Mock).mockRejectedValue(new PlatformDomainError('Invalid slug'));

    const err = await controller
      .provision({ name: 'T', slug: 'bad!', adminEmail: 'a@a.com' })
      .catch((e: HttpException) => e);

    expect(err).toBeInstanceOf(HttpException);
    expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    const body = (err as HttpException).getResponse() as Record<string, unknown>;
    expect(body['detail']).toBe('Invalid slug');
  });

  it('re-throws non-domain errors unchanged', async () => {
    const unexpected = new Error('db down');
    (useCase.execute as jest.Mock).mockRejectedValue(unexpected);

    await expect(
      controller.provision({ name: 'T', slug: 'test', adminEmail: 'a@a.com' }),
    ).rejects.toThrow('db down');
  });
});
