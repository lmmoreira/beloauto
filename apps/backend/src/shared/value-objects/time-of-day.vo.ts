const HHMM_PATTERN = /^\d{2}:\d{2}$/;

export class TimeOfDay {
  private constructor(private readonly _value: string) {}

  static isValid(time: string): boolean {
    if (!HHMM_PATTERN.test(time)) return false;
    const [hh, mm] = time.split(':').map(Number) as [number, number];
    return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
  }

  static create(time: string): TimeOfDay {
    if (!TimeOfDay.isValid(time)) {
      throw new Error(`"${time}" is not a valid time — expected HH:MM (00:00–23:59)`);
    }
    return new TimeOfDay(time);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }

  isBefore(other: TimeOfDay): boolean {
    return this._value < other._value;
  }
}
