export interface AvailableSlot {
  startsAt: string; // ISO-8601 datetime
  endsAt: string; // ISO-8601 datetime
}

export interface AvailabilityResponse {
  date: string; // YYYY-MM-DD
  slots: AvailableSlot[];
  available: boolean;
}

export interface DaySummary {
  date: string; // YYYY-MM-DD
  available: boolean;
  slotCount: number;
}

export type AvailabilitySummaryResponse = DaySummary[];
