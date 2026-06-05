import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../../../../shared/http/zod-validation.pipe';
import {
  GenerateAttachmentSignedUrlBody,
  GenerateAttachmentSignedUrlSchema,
} from '../../application/dtos/generate-attachment-signed-url.dto';
import {
  GenerateAttachmentSignedUrlResult,
  GenerateAttachmentSignedUrlUseCase,
} from '../../application/use-cases/generate-attachment-signed-url.use-case';
import { mapBookingError } from '../http/booking-error.mapper';
@Controller('bookings/attachments')
export class BookingAttachmentsController {
  constructor(private readonly generateSignedUrl: GenerateAttachmentSignedUrlUseCase) {}

  @Post('signed-url')
  @HttpCode(HttpStatus.CREATED)
  generateAttachmentSignedUrl(
    @Body(new ZodValidationPipe(GenerateAttachmentSignedUrlSchema))
    body: GenerateAttachmentSignedUrlBody,
  ): Promise<GenerateAttachmentSignedUrlResult> {
    return this.generateSignedUrl.execute(body).catch(mapBookingError);
  }
}
