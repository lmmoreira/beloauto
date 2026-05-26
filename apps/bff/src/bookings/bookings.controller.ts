import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../shared/decorators/public.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { ZodValidationPipe } from '../shared/http/zod-validation.pipe';
import { BackendHttpService } from '../shared/http/backend-http.service';
import { TenantInfoResponse } from '../shared/types/backend-responses';
import { BookingResponse } from './bookings.types';

const AddressSchema = z.object({
  street: z.string().min(1),
  number: z.string().min(1),
  complement: z.string().nullable().optional(),
  neighborhood: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zipCode: z.string().regex(/^\d{8}$/, 'zipCode must be 8 digits'),
});

export const RequestBookingBodySchema = z.object({
  guestEmail: z.email(),
  guestName: z.string().min(1),
  guestPhone: z.string().refine((v) => {
    const d = v.replace(/\D/g, '');
    return d.length === 10 || d.length === 11;
  }, 'guestPhone must have 10 or 11 digits'),
  guestAddress: AddressSchema.optional(),
  pickupAddress: AddressSchema.optional(),
  scheduledAt: z.iso.datetime(),
  serviceIds: z.array(z.uuid()).min(1),
  beforeServicePhotoUrls: z.array(z.url()).optional(),
});

export const AuthenticatedBookingBodySchema = z.object({
  scheduledAt: z.iso.datetime(),
  serviceIds: z.array(z.uuid()).min(1),
  pickupAddress: AddressSchema.optional(),
  beforeServicePhotoUrls: z.array(z.url()).optional(),
});

export const RejectBookingBodySchema = z.object({
  reason: z.string().trim().min(10),
});

export const RequestMoreInfoBodySchema = z.object({
  message: z.string().trim().min(20),
});

type RequestBookingBody = z.infer<typeof RequestBookingBodySchema>;
type AuthenticatedBookingBody = z.infer<typeof AuthenticatedBookingBodySchema>;
type RejectBookingBody = z.infer<typeof RejectBookingBodySchema>;
type RequestMoreInfoBody = z.infer<typeof RequestMoreInfoBodySchema>;

@Controller('bookings')
export class BookingsController {
  constructor(private readonly backendHttp: BackendHttpService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Public()
  async create(
    @Headers('x-tenant-slug') tenantSlug: string | undefined,
    @Body(new ZodValidationPipe(RequestBookingBodySchema)) body: RequestBookingBody,
  ): Promise<BookingResponse> {
    if (!tenantSlug) {
      throw new HttpException(
        {
          type: 'about:blank',
          title: 'Bad Request',
          status: HttpStatus.BAD_REQUEST,
          detail: 'X-Tenant-Slug header is required',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const tenant = await this.backendHttp.get<TenantInfoResponse>(
      `/internal/tenants/by-slug/${tenantSlug}`,
    );

    return this.backendHttp.postForPublic<BookingResponse>('/bookings', body, tenant.id);
  }

  @Post('authenticated')
  @HttpCode(HttpStatus.CREATED)
  @Roles('CUSTOMER')
  createAuthenticated(
    @Body(new ZodValidationPipe(AuthenticatedBookingBodySchema)) body: AuthenticatedBookingBody,
  ): Promise<BookingResponse> {
    return this.backendHttp.post<BookingResponse>('/bookings/authenticated', body);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'STAFF')
  approve(
    @Param('id') id: string,
  ): Promise<{ bookingId: string; status: string; approvedAt: string }> {
    return this.backendHttp.patch(`/bookings/${id}/approve`, {});
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'STAFF')
  reject(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectBookingBodySchema)) body: RejectBookingBody,
  ): Promise<{ bookingId: string; status: string; rejectedAt: string }> {
    return this.backendHttp.patch(`/bookings/${id}/reject`, body);
  }

  @Patch(':id/request-info')
  @HttpCode(HttpStatus.OK)
  @Roles('MANAGER', 'STAFF')
  requestInfo(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RequestMoreInfoBodySchema)) body: RequestMoreInfoBody,
  ): Promise<{ bookingId: string; status: string; infoRequestedAt: string }> {
    return this.backendHttp.patch(`/bookings/${id}/request-info`, body);
  }
}
