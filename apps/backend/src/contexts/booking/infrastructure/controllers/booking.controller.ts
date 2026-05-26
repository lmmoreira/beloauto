import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  RequestBookingDto,
  RequestBookingSchema,
} from '../../application/dtos/request-booking.dto';
import {
  RequestAuthenticatedBookingDto,
  RequestAuthenticatedBookingSchema,
} from '../../application/dtos/request-authenticated-booking.dto';
import { ApproveBookingUseCaseResult } from '../../application/dtos/approve-booking.dto';
import {
  RejectBookingBody,
  RejectBookingBodySchema,
  RejectBookingUseCaseResult,
} from '../../application/dtos/reject-booking.dto';
import {
  RequestBookingUseCase,
  RequestBookingUseCaseResult,
} from '../../application/use-cases/request-booking.use-case';
import {
  RequestAuthenticatedBookingUseCase,
  RequestAuthenticatedBookingUseCaseResult,
} from '../../application/use-cases/request-authenticated-booking.use-case';
import { ApproveBookingUseCase } from '../../application/use-cases/approve-booking.use-case';
import { RejectBookingUseCase } from '../../application/use-cases/reject-booking.use-case';
import { StaffOrManagerRoleGuard } from '../guards/staff-or-manager-role.guard';
import { mapBookingError } from '../http/booking-error.mapper';

@Controller('bookings')
export class BookingController {
  constructor(
    private readonly requestBooking: RequestBookingUseCase,
    private readonly requestAuthenticatedBooking: RequestAuthenticatedBookingUseCase,
    private readonly approveBooking: ApproveBookingUseCase,
    private readonly rejectBooking: RejectBookingUseCase,
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

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrManagerRoleGuard)
  approve(@Param('id') id: string): Promise<ApproveBookingUseCaseResult> {
    return this.approveBooking.execute({ bookingId: id }).catch(mapBookingError);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @UseGuards(StaffOrManagerRoleGuard)
  reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectBookingBodySchema)) body: RejectBookingBody,
  ): Promise<RejectBookingUseCaseResult> {
    return this.rejectBooking
      .execute({ bookingId: id, reason: body.reason })
      .catch(mapBookingError);
  }
}
