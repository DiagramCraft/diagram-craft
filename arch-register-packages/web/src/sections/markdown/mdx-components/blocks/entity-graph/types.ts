import type { TElement } from 'platejs';
import type { EntityGraphDirection } from '../../../../entities/components/entityGraphState';

export type { EntityGraphDirection };

export interface EntityGraphSlateElement extends TElement {
  entityId?: string;
  depth?: number;
  direction?: EntityGraphDirection;
}

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

export const normalizeEntityGraphProps = (
  props: Record<string, string>
): Record<string, string> => ({
  ...props,
  ...(Object.hasOwn(props, 'depth')
    ? { depth: String(normalizeEntityGraphDepth(props.depth)) }
    : {}),
  ...(Object.hasOwn(props, 'direction')
    ? { direction: normalizeEntityGraphDirection(props.direction) }
    : {})
});
