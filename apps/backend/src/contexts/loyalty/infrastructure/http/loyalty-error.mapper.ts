import { HttpException, HttpStatus } from '@nestjs/common';

export function mapLoyaltyError(err: unknown): never {
  throw new HttpException(
    {
      type: 'about:blank',
      title: 'Internal Server Error',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: err instanceof Error ? err.message : 'Unexpected error',
    },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
}
