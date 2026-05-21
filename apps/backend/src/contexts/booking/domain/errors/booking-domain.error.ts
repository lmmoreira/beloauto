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

export class OpeningDateInPastError extends BookingDomainError {
  constructor() {
    super('Cannot open a schedule for a past date');
    this.name = 'OpeningDateInPastError';
  }
}

export class DayAlreadyOpenInSettingsError extends BookingDomainError {
  constructor(date: string) {
    super(`Day is already open in business hours settings: ${date}`);
    this.name = 'DayAlreadyOpenInSettingsError';
  }
}

export class ScheduleOpeningAlreadyExistsError extends BookingDomainError {
  constructor(date: string) {
    super(`A schedule opening already exists for date: ${date}`);
    this.name = 'ScheduleOpeningAlreadyExistsError';
  }
}

export class ScheduleOpeningNotFoundError extends BookingDomainError {
  constructor(id: string) {
    super(`Schedule opening not found: ${id}`);
    this.name = 'ScheduleOpeningNotFoundError';
  }
}
