import { Controller, Get, Headers, HttpException, HttpStatus, Query } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../shared/decorators/public.decorator';
import { ZodValidationPipe } from '../shared/http/zod-validation.pipe';
import { BackendHttpService } from '../shared/http/backend-http.service';
import { AvailabilitySummaryResponse } from './schedule.types';

const GetAvailabilitySummaryQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'from must be YYYY-MM-DD'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'to must be YYYY-MM-DD'),
  serviceIds: z.string().min(1, 'serviceIds is required'),
});

type GetAvailabilitySummaryQuery = z.infer<typeof GetAvailabilitySummaryQuerySchema>;

@Controller('schedule/availability/summary')
export class ScheduleAvailabilitySummaryController {
  constructor(private readonly backendHttp: BackendHttpService) {}

  @Get()
  @Public()
  async get(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Query(new ZodValidationPipe(GetAvailabilitySummaryQuerySchema))
    query: GetAvailabilitySummaryQuery,
  ): Promise<AvailabilitySummaryResponse> {
    if (!tenantSlug) {
      throw new HttpException(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: 400,
          detail: 'X-Tenant-Slug header is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const tenant = await this.backendHttp.get<{ id: string }>(
      `/internal/tenants/by-slug/${tenantSlug}`,
    );

    return this.backendHttp.getForPublic<AvailabilitySummaryResponse>(
      `/schedule/availability/summary?from=${query.from}&to=${query.to}&serviceIds=${query.serviceIds}`,
      tenant.id,
    );
  }
}
