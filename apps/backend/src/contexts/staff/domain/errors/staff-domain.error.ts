export class StaffDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffDomainError';
  }
}
