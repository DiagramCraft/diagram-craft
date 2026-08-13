import type { EntityGraphDirection } from './entityGraphState';

export type EntityGraphConfig = {
  maxDepth: number;
  direction: EntityGraphDirection;
  relationSchemaIds: string[];
};

export const defaultEntityGraphConfig: EntityGraphConfig = {
  maxDepth: 2,
  direction: 'both',
  relationSchemaIds: []
};

export const normalizeEntityGraphConfig = (value: unknown): EntityGraphConfig => {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    return { ...defaultEntityGraphConfig };
  }

  const config = value as Record<string, unknown>;
  const maxDepth =
    typeof config.maxDepth === 'number' && Number.isInteger(config.maxDepth)
      ? Math.min(5, Math.max(1, config.maxDepth))
      : defaultEntityGraphConfig.maxDepth;
  const direction: EntityGraphDirection =
    config.direction === 'upstream' ||
    config.direction === 'downstream' ||
    config.direction === 'both'
      ? config.direction
      : defaultEntityGraphConfig.direction;
  const relationSchemaIds = Array.isArray(config.relationSchemaIds)
    ? config.relationSchemaIds.filter((id): id is string => typeof id === 'string')
    : defaultEntityGraphConfig.relationSchemaIds;

  return { maxDepth, direction, relationSchemaIds };
};
