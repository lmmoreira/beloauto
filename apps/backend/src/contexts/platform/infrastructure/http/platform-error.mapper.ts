import { HttpException, HttpStatus } from '@nestjs/common';
import { ProblemDetail } from '../../../../shared/http/problem-detail';
import {
  PlatformDomainError,
  SlugAlreadyTakenError,
} from '../../domain/errors/platform-domain.error';

export function mapPlatformError(err: unknown): never {
  if (err instanceof SlugAlreadyTakenError) {
    const body: ProblemDetail = {
      type: 'about:blank',
      title: 'Conflict',
      status: HttpStatus.CONFLICT,
      detail: err.message,
    };
    throw new HttpException(body, HttpStatus.CONFLICT);
  }
  if (err instanceof PlatformDomainError) {
    const body: ProblemDetail = {
      type: 'about:blank',
      title: 'Bad Request',
      status: HttpStatus.BAD_REQUEST,
      detail: err.message,
    };
    throw new HttpException(body, HttpStatus.BAD_REQUEST);
  }
  throw err as Error;
}
