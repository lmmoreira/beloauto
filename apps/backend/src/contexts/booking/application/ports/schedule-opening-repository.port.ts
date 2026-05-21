import { ScheduleOpening } from '../../domain/schedule-opening.aggregate';

export const SCHEDULE_OPENING_REPOSITORY = Symbol('IScheduleOpeningRepository');

export interface IScheduleOpeningRepository {
  findByTenantAndDate(tenantId: string, date: string): Promise<ScheduleOpening | null>;
  findByTenantAndDateRange(tenantId: string, from: string, to: string): Promise<ScheduleOpening[]>;
  findById(id: string, tenantId: string): Promise<ScheduleOpening | null>;
  save(opening: ScheduleOpening): Promise<void>;
  delete(id: string, tenantId: string): Promise<void>;
}
