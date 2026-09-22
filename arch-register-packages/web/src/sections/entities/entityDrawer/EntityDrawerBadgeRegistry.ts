import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ReactNode } from 'react';

export type ResolvedDerivedBadge = {
  label: ReactNode;
  color: string;
};

export type EntityDrawerBadgeDefinition = {
  badgeId: string;
  resolve: (entity: EntityRecord) => ResolvedDerivedBadge | null;
};

export type EntityDrawerBadgeRegistry = {
  definitions: readonly EntityDrawerBadgeDefinition[];
  get: (badgeId: string) => EntityDrawerBadgeDefinition | undefined;
};

export const createEntityDrawerBadgeRegistry = (
  definitions: readonly EntityDrawerBadgeDefinition[]
): EntityDrawerBadgeRegistry => {
  const byId = new Map<string, EntityDrawerBadgeDefinition>();
  for (const definition of definitions) {
    if (byId.has(definition.badgeId)) {
      throw new Error(`Duplicate entity drawer badge '${definition.badgeId}'.`);
    }
    byId.set(definition.badgeId, definition);
  }

  return {
    definitions,
    get: badgeId => byId.get(badgeId)
  };
};
