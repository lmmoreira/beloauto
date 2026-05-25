import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  RequestBookingDto,
  RequestBookingSchema,
} from '../../application/dtos/request-booking.dto';
import {
  RequestAuthenticatedBookingDto,
  RequestAuthenticatedBookingSchema,
} from '../../application/dtos/request-authenticated-booking.dto';
import {
  RequestBookingUseCase,
  RequestBookingUseCaseResult,
} from '../../application/use-cases/request-booking.use-case';
import {
  RequestAuthenticatedBookingUseCase,
  RequestAuthenticatedBookingUseCaseResult,
} from '../../application/use-cases/request-authenticated-booking.use-case';
import { mapBookingError } from '../http/booking-error.mapper';

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly requestBooking: RequestBookingUseCase,
    private readonly requestAuthenticatedBooking: RequestAuthenticatedBookingUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(RequestBookingSchema)) body: RequestBookingDto,
  ): Promise<RequestBookingUseCaseResult> {
    return this.requestBooking.execute(body).catch(mapBookingError);
  }

  @Post('authenticated')
  @HttpCode(HttpStatus.CREATED)
  createAuthenticated(
    @Body(new ZodValidationPipe(RequestAuthenticatedBookingSchema))
    body: RequestAuthenticatedBookingDto,
  ): Promise<RequestAuthenticatedBookingUseCaseResult> {
    return this.requestAuthenticatedBooking.execute(body).catch(mapBookingError);
  }
}
