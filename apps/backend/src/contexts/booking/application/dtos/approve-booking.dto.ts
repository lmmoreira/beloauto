export interface ApproveBookingDto {
  bookingId: string;
}

export interface ApproveBookingUseCaseResult {
  bookingId: string;
  status: string;
  approvedAt: string;
}
