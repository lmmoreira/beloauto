import { IScheduleOpeningRepository } from '../../../contexts/booking/application/ports/schedule-opening-repository.port';
import { ScheduleOpening } from '../../../contexts/booking/domain/schedule-opening.aggregate';

export class InMemoryScheduleOpeningRepository implements IScheduleOpeningRepository {
  private store: ScheduleOpening[] = [];

  async findByTenantAndDate(tenantId: string, date: string): Promise<ScheduleOpening | null> {
    return this.store.find((o) => o.tenantId === tenantId && o.date === date) ?? null;
  }

  async findByTenantAndDateRange(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<ScheduleOpening[]> {
    return this.store
      .filter((o) => o.tenantId === tenantId && o.date >= from && o.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findById(id: string, tenantId: string): Promise<ScheduleOpening | null> {
    return this.store.find((o) => o.id === id && o.tenantId === tenantId) ?? null;
  }

  async save(opening: ScheduleOpening): Promise<void> {
    const idx = this.store.findIndex((o) => o.id === opening.id);
    if (idx >= 0) {
      this.store[idx] = opening;
    } else {
      this.store.push(opening);
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    this.store = this.store.filter((o) => !(o.id === id && o.tenantId === tenantId));
  }

  clear(): void {
    this.store = [];
  }
}
