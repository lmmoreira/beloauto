import { HttpException, HttpStatus } from '@nestjs/common';
import { ProblemDetail } from '../../../../shared/http/problem-detail';
import { StaffDomainError, StaffNotFoundError } from '../../domain/errors/staff-domain.error';

export function mapStaffError(err: unknown): never {
  if (err instanceof StaffNotFoundError) {
    const body: ProblemDetail = {
      type: 'about:blank',
      title: 'Not Found',
      status: HttpStatus.NOT_FOUND,
      detail: err.message,
    };
    throw new HttpException(body, HttpStatus.NOT_FOUND);
  }
  if (err instanceof StaffDomainError) {
    const body: ProblemDetail = {
      type: 'about:blank',
      title: 'Bad Request',
      status: HttpStatus.BAD_REQUEST,
      detail: err.message,
    };
    throw new HttpException(body, HttpStatus.BAD_REQUEST);
  }
  if (err instanceof Error) throw err;
  throw new Error(`Unexpected error: ${String(err)}`);
}
