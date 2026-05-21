import { IScheduleClosureRepository } from '../../../contexts/booking/application/ports/schedule-closure-repository.port';
import { ScheduleClosure } from '../../../contexts/booking/domain/schedule-closure.aggregate';

export class InMemoryScheduleClosureRepository implements IScheduleClosureRepository {
  private store: ScheduleClosure[] = [];

  async findByTenantAndDateRange(
    tenantId: string,
    from: string,
    to: string,
  ): Promise<ScheduleClosure[]> {
    return this.store
      .filter((c) => c.tenantId === tenantId && c.date >= from && c.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async findByTenantAndDate(tenantId: string, date: string): Promise<ScheduleClosure | null> {
    return this.store.find((c) => c.tenantId === tenantId && c.date === date) ?? null;
  }

  async findById(id: string, tenantId: string): Promise<ScheduleClosure | null> {
    return this.store.find((c) => c.id === id && c.tenantId === tenantId) ?? null;
  }

  async save(closure: ScheduleClosure): Promise<void> {
    const idx = this.store.findIndex((c) => c.id === closure.id);
    if (idx >= 0) {
      this.store[idx] = closure;
    } else {
      this.store.push(closure);
    }
  }

  async delete(id: string, tenantId: string): Promise<void> {
    this.store = this.store.filter((c) => !(c.id === id && c.tenantId === tenantId));
  }

  clear(): void {
    this.store = [];
  }
}
