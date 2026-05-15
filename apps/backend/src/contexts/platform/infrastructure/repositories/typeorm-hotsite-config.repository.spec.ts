import { Repository } from 'typeorm';
import { HotsiteConfig } from '../../domain/hotsite-config.aggregate';
import { HotsiteConfigEntity } from '../entities/hotsite-config.entity';
import { TypeOrmHotsiteConfigRepository } from './typeorm-hotsite-config.repository';
import { HotsiteConfigBuilder, HotsiteConfigEntityBuilder } from '../../../../test/builders/platform';

describe('TypeOrmHotsiteConfigRepository', () => {
  let mockRepo: jest.Mocked<Repository<HotsiteConfigEntity>>;
  let repo: TypeOrmHotsiteConfigRepository;

  beforeEach(() => {
    mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<HotsiteConfigEntity>>;
    repo = new TypeOrmHotsiteConfigRepository(mockRepo);
  });

  describe('findByTenantId', () => {
    it('returns a HotsiteConfig aggregate when found', async () => {
      mockRepo.findOne.mockResolvedValue(new HotsiteConfigEntityBuilder().build());

      const result = await repo.findByTenantId('tenant-id-1');

      expect(result).toBeInstanceOf(HotsiteConfig);
      expect(result!.id).toBe('config-id-1');
      expect(result!.tenantId).toBe('tenant-id-1');
      expect(result!.isPublished).toBe(false);
      expect(result!.branding).toEqual({ primaryColor: '#FFFFFF' });
      expect(result!.layout).toHaveLength(1);
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 'tenant-id-1' } });
    });

    it('returns null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      expect(await repo.findByTenantId('unknown-tenant')).toBeNull();
    });

    it('correctly maps isPublished = true', async () => {
      mockRepo.findOne.mockResolvedValue(
        new HotsiteConfigEntityBuilder().withIsPublished(true).build(),
      );

      const result = await repo.findByTenantId('tenant-id-1');
      expect(result!.isPublished).toBe(true);
    });
  });

  describe('save', () => {
    it('maps domain aggregate to entity and persists it', async () => {
      const config = new HotsiteConfigBuilder()
        .withTenantId('tenant-id-2')
        .buildWithContent({ primaryColor: '#112233' }, [{ type: 'HERO', order: 1 }]);
      mockRepo.save.mockResolvedValue({} as HotsiteConfigEntity);

      await repo.save(config);

      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      const savedEntity = mockRepo.save.mock.calls[0][0] as HotsiteConfigEntity;
      expect(savedEntity.id).toBe(config.id);
      expect(savedEntity.tenantId).toBe('tenant-id-2');
      expect(savedEntity.branding).toEqual({ primaryColor: '#112233' });
      expect(savedEntity.layout).toHaveLength(1);
      expect(savedEntity.isPublished).toBe(false);
    });
  });
});
