import { HttpException, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ProvisionTenantUseCase } from '../../application/use-cases/provision-tenant.use-case';
import {
  PlatformDomainError,
  SlugAlreadyTakenError,
} from '../../domain/errors/platform-domain.error';
import { InternalTenantController } from './internal-tenant.controller';

const RESULT = { tenantId: 'uuid-1', name: 'Lavacar', slug: 'lavacar' };

describe('InternalTenantController', () => {
  let controller: InternalTenantController;
  let execute: jest.Mock;

  beforeEach(async () => {
    execute = jest.fn();
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalTenantController],
      providers: [{ provide: ProvisionTenantUseCase, useValue: { execute } }],
    }).compile();

    controller = moduleRef.get(InternalTenantController);
  });

  it('calls use case and returns the result', async () => {
    execute.mockResolvedValue(RESULT);
    const dto = { name: 'Lavacar', slug: 'lavacar', adminEmail: 'a@a.com' };
    expect(await controller.provision(dto)).toEqual(RESULT);
    expect(execute).toHaveBeenCalledWith(dto);
  });

  it('maps SlugAlreadyTakenError to 409 HttpException', async () => {
    execute.mockRejectedValue(new SlugAlreadyTakenError('lavacar'));

    expect.assertions(2);
    try {
      await controller.provision({ name: 'T', slug: 'lavacar', adminEmail: 'a@a.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.CONFLICT);
    }
  });

  it('maps PlatformDomainError to 400 HttpException', async () => {
    execute.mockRejectedValue(new PlatformDomainError('Invalid name'));

    expect.assertions(2);
    try {
      await controller.provision({ name: '', slug: 'test', adminEmail: 'a@a.com' });
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
    }
  });

  it('re-throws non-domain errors unchanged', async () => {
    execute.mockRejectedValue(new Error('db down'));
    await expect(
      controller.provision({ name: 'T', slug: 'test', adminEmail: 'a@a.com' }),
    ).rejects.toThrow('db down');
  });
});
