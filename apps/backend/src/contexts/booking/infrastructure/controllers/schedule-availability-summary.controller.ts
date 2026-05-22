import { Controller, Get, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  GetAvailabilitySummaryDto,
  GetAvailabilitySummarySchema,
} from '../../application/dtos/get-availability-summary.dto';
import { GetAvailabilitySummaryUseCase } from '../../application/use-cases/get-availability-summary.use-case';
import { mapBookingError } from '../http/booking-error.mapper';

@Controller('schedule/availability/summary')
export class ScheduleAvailabilitySummaryController {
  constructor(private readonly getAvailabilitySummary: GetAvailabilitySummaryUseCase) {}

  @Get()
  get(@Query(new ZodValidationPipe(GetAvailabilitySummarySchema)) dto: GetAvailabilitySummaryDto) {
    return this.getAvailabilitySummary.execute(dto).catch(mapBookingError);
  }
}
