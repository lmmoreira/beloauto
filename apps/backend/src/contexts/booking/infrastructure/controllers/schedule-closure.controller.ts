import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  CloseScheduleDto,
  CloseScheduleSchema,
  ListClosuresDto,
  ListClosuresSchema,
} from '../../application/dtos/close-schedule.dto';
import {
  CloseScheduleUseCase,
  CloseScheduleUseCaseResult,
} from '../../application/use-cases/close-schedule.use-case';
import {
  ListClosuresUseCase,
  ListClosuresUseCaseResult,
} from '../../application/use-cases/list-closures.use-case';
import { RemoveClosureUseCase } from '../../application/use-cases/remove-closure.use-case';
import { StaffOrManagerRoleGuard } from '../../../../shared/guards/staff-or-manager-role.guard';
import { mapBookingError } from '../http/booking-error.mapper';

@Controller('schedule/closures')
@UseGuards(StaffOrManagerRoleGuard)
export class ScheduleClosureController {
  constructor(
    private readonly closeSchedule: CloseScheduleUseCase,
    private readonly removeClosure: RemoveClosureUseCase,
    private readonly listClosures: ListClosuresUseCase,
  ) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ListClosuresSchema)) query: ListClosuresDto,
  ): Promise<ListClosuresUseCaseResult> {
    return this.listClosures.execute(query).catch(mapBookingError);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body(new ZodValidationPipe(CloseScheduleSchema)) body: CloseScheduleDto,
  ): Promise<CloseScheduleUseCaseResult> {
    return this.closeSchedule.execute(body).catch(mapBookingError);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', new ParseUUIDPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })) id: string,
  ): Promise<void> {
    return this.removeClosure.execute(id).catch(mapBookingError);
  }
}
