const SLUG_PATTERN = /^[a-z0-9-]+$/;

export class Slug {
  private constructor(private readonly _value: string) {}

  static isValid(slug: string): boolean {
    return typeof slug === 'string' && slug.length > 0 && SLUG_PATTERN.test(slug);
  }

  static create(slug: string): Slug {
    if (!Slug.isValid(slug)) {
      throw new Error(
        `"${slug}" is not a valid slug — use only lowercase letters, numbers, and hyphens`,
      );
    }
    return new Slug(slug);
  }

  get value(): string {
    return this._value;
  }

  toString(): string {
    return this._value;
  }
}
