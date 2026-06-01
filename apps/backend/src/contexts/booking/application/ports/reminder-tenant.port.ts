export const REMINDER_TENANT_PORT = Symbol('IReminderTenantPort');

export interface ActiveTenantInfo {
  id: string;
  timezone: string;
}

export interface IReminderTenantPort {
  findAllActive(): Promise<ActiveTenantInfo[]>;
}
