export class PhoneNumber {
  private constructor(private readonly _value: string) {}

  // Strips all non-digits and checks for 10–11 digits (Brazilian mobile/landline)
  static isValid(phone: string): boolean {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 || digits.length === 11;
  }

  // Normalises to digits only for consistent storage
  static create(phone: string): PhoneNumber {
    if (!PhoneNumber.isValid(phone)) {
      throw new Error(`"${phone}" is not a valid phone number — expected 10 or 11 digits`);
    }
    return new PhoneNumber(phone.replace(/\D/g, ''));
  }

  get value(): string {
    return this._value;
  }

  // Formats as (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  format(): string {
    const d = this._value;
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }

  toString(): string {
    return this._value;
  }
}
