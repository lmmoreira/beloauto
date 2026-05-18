export class StaffDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StaffDomainError';
  }
}

export class StaffNotFoundError extends StaffDomainError {
  constructor(googleOAuthId: string) {
    super(`No staff member found for Google account: ${googleOAuthId}`);
    this.name = 'StaffNotFoundError';
  }
}
