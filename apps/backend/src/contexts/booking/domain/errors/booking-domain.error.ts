export class BookingDomainError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.name = 'BookingDomainError';
  }
}

export class ServiceNotFoundError extends BookingDomainError {
  constructor(id: string) {
    super(`Service not found: ${id}`);
    this.name = 'ServiceNotFoundError';
  }
}

export class ServiceDeactivatedError extends BookingDomainError {
  constructor() {
    super('Cannot update a deactivated service');
    this.name = 'ServiceDeactivatedError';
  }
}

export class ClosureDateInPastError extends BookingDomainError {
  constructor() {
    super('Cannot close a schedule for a past date');
    this.name = 'ClosureDateInPastError';
  }
}

export class ScheduleClosureNotFoundError extends BookingDomainError {
  constructor(id: string) {
    super(`Schedule closure not found: ${id}`);
    this.name = 'ScheduleClosureNotFoundError';
  }
}

export class ScheduleAlreadyClosedError extends BookingDomainError {
  constructor(date: string) {
    super(`Schedule is already closed for date: ${date}`);
    this.name = 'ScheduleAlreadyClosedError';
  }
}
