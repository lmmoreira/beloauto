import { PlatformDomainError } from './errors/platform-domain.error';
import { HotsiteConfigBuilder } from '../../../test/builders';

describe('HotsiteConfig', () => {
  describe('create()', () => {
    it('creates an unpublished config with empty layout', () => {
      const config = new HotsiteConfigBuilder().build();
      expect(config.tenantId).toBe('01234567-0000-7000-8000-000000000001');
      expect(config.isPublished).toBe(false);
      expect(config.layout).toHaveLength(0);
      expect(config.id).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('publish()', () => {
    it('sets isPublished to true after content is added', () => {
      const config = new HotsiteConfigBuilder().buildWithContent();
      config.publish();
      expect(config.isPublished).toBe(true);
    });

    it('throws when layout is empty', () => {
      const config = new HotsiteConfigBuilder().build();
      expect(() => config.publish()).toThrow(PlatformDomainError);
    });
  });

  describe('unpublish()', () => {
    it('sets isPublished to false', () => {
      const config = new HotsiteConfigBuilder().buildWithContent();
      config.publish();
      config.unpublish();
      expect(config.isPublished).toBe(false);
    });
  });

  describe('updateContent()', () => {
    it('updates branding and layout', () => {
      const config = new HotsiteConfigBuilder().build();
      config.updateContent({ primaryColor: '#123456', logoUrl: 'https://example.com/logo.png' }, [
        { type: 'HERO', order: 0 },
        { type: 'BOOKING_CTA', order: 1 },
      ]);
      expect(config.branding.primaryColor).toBe('#123456');
      expect(config.layout).toHaveLength(2);
    });

    it('throws for invalid hex color', () => {
      const config = new HotsiteConfigBuilder().build();
      expect(() =>
        config.updateContent({ primaryColor: 'red' }, [{ type: 'HERO', order: 1 }]),
      ).toThrow(PlatformDomainError);
    });

    it('accepts branding without primaryColor', () => {
      const config = new HotsiteConfigBuilder().build();
      expect(() =>
        config.updateContent({ logoUrl: 'https://example.com/logo.png' }, [
          { type: 'HERO', order: 1 },
        ]),
      ).not.toThrow();
    });
  });
});
