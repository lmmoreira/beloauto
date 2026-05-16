export class PlatformDomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlatformDomainError';
  }
}

export class SlugAlreadyTakenError extends PlatformDomainError {
  constructor(slug: string) {
    super(`Slug '${slug}' is already in use`);
    this.name = 'SlugAlreadyTakenError';
  }
}
