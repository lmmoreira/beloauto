export class Timezone {
  private constructor(private readonly _value: string) {}

  static isValid(tz: string): boolean {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }

  static create(tz: string): Timezone {
    if (!Timezone.isValid(tz)) throw new Error(`"${tz}" is not a valid IANA timezone`);
    return new Timezone(tz);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
