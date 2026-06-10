import { z } from 'zod';
import type { HeroModuleData, HotsiteModuleType, ServiceListModuleData } from '@beloauto/types';

// Mirrors HeroModuleData (packages/types/src/hotsite.ts) — keep in sync when that type changes.
export const HeroModuleDataSchema = z.object({
  variant: z.enum(['centered', 'left-aligned']),
  title: z.string(),
  subtitle: z.string().optional(),
  backgroundImageUrl: z.string().optional(),
  ctaLabel: z.string(),
  ctaTarget: z.enum(['booking', 'service-list']),
}) satisfies z.ZodType<HeroModuleData>;

// Mirrors ServiceListModuleData (packages/types/src/hotsite.ts) — keep in sync when that type changes.
export const ServiceListModuleDataSchema = z.object({
  title: z.string().optional(),
  showPrices: z.boolean(),
  showPoints: z.boolean(),
  layout: z.enum(['grid', 'list']),
}) satisfies z.ZodType<ServiceListModuleData>;

const MODULE_DATA_SCHEMAS: Partial<Record<HotsiteModuleType, z.ZodType>> = {
  HERO: HeroModuleDataSchema,
  SERVICE_LIST: ServiceListModuleDataSchema,
};

// Module types without a registered schema render unvalidated until their story (M12-S05+) adds one.
export function isValidModuleData(type: HotsiteModuleType, data: unknown): boolean {
  const schema = MODULE_DATA_SCHEMAS[type];
  return schema ? schema.safeParse(data).success : true;
}
