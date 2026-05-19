import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { CurrentUser, CurrentUserPayload } from '../shared/decorators/current-user.decorator';
import { Roles } from '../shared/decorators/roles.decorator';
import { BackendHttpService } from '../shared/http/backend-http.service';

@Controller('v1/staff')
@Roles('MANAGER')
export class StaffController {
  constructor(private readonly backendHttp: BackendHttpService) {}

  @Get()
  list(
    @CurrentUser() user: CurrentUserPayload,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ): Promise<unknown> {
    return this.backendHttp.get('/internal/staff', { tenantId: user.tenantId, limit, offset });
  }

  @Get(':id')
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<unknown> {
    return this.backendHttp.get(`/internal/staff/${id}`, { tenantId: user.tenantId });
  }
}
