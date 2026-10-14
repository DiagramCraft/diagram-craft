import type { EntityGraphDirection } from '../../../../entities/components/entityGraphState';
import { z } from 'zod';
import { withInitial } from '../../configSchema';

export type { EntityGraphDirection };

export const entityGraphWidgetConfigSchema = z.object({
  entityId: withInitial(z.string().min(1), ''),
  depth: withInitial(z.number().optional(), 1),
  direction: withInitial(z.enum(['upstream', 'downstream', 'both']).optional(), 'both')
});

export type EntityGraphWidgetConfig = z.infer<typeof entityGraphWidgetConfigSchema>;

export const normalizeEntityGraphDepth = (value: unknown): number => {
  if (value == null || (typeof value === 'string' && value.trim() === '')) return 1;

  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 1;

  return Math.min(3, Math.max(1, Math.trunc(parsed)));
};

export const normalizeEntityGraphDirection = (value: unknown): EntityGraphDirection => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'upstream' || normalized === 'downstream' || normalized === 'both') {
      return normalized;
    }
  }
  return 'both';
};
