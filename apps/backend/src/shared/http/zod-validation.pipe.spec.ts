import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

const schema = z.object({
  name: z.string().min(1, 'name is required'),
  count: z.number(),
});

describe('ZodValidationPipe', () => {
  let pipe: ZodValidationPipe;

  beforeEach(() => {
    pipe = new ZodValidationPipe(schema);
  });

  it('returns the parsed value for valid input', () => {
    expect(pipe.transform({ name: 'Test', count: 3 })).toEqual({ name: 'Test', count: 3 });
  });

  it('throws BadRequestException for invalid input', () => {
    expect(() => pipe.transform({ name: '', count: 'not-a-number' })).toThrow(BadRequestException);
  });

  it('error response is a RFC 9457 Problem Detail with violations array', () => {
    let caught: BadRequestException | undefined;
    try {
      pipe.transform({ name: '', count: 'oops' });
    } catch (e) {
      caught = e as BadRequestException;
    }

    const body = caught!.getResponse() as Record<string, unknown>;
    expect(body['type']).toBe('about:blank');
    expect(body['status']).toBe(400);
    expect(body['title']).toBe('Bad Request');
    expect(Array.isArray(body['violations'])).toBe(true);
    expect((body['violations'] as unknown[]).length).toBeGreaterThan(0);
  });

  it('violation entries include field and message', () => {
    let caught: BadRequestException | undefined;
    try {
      pipe.transform({ name: '' });
    } catch (e) {
      caught = e as BadRequestException;
    }

    const violations = (caught!.getResponse() as Record<string, unknown>)['violations'] as Array<
      Record<string, string>
    >;
    expect(violations.some((v) => v['field'] === 'count')).toBe(true);
  });
});
