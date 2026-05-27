export interface BookedSlot {
  id: string;
  scheduledAt: Date; // UTC
  totalDurationMins: number;
}
