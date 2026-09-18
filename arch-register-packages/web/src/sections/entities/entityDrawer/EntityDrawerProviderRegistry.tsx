import type { ComponentType, ReactNode } from 'react';
import type { EntityRelations, EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityDrawerItem } from '@arch-register/api-types/entityDrawerConfiguration';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

export type EntityDrawerProviderContext = {
  workspaceId: string;
  entity: EntityRecord;
  schema: EntitySchema;
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  relations: EntityRelations;
  typedRelations: {
    outgoing: RelationRecord[];
    incoming: RelationRecord[];
  };
  openEntity: (entityId: string) => void;
};

export type EntityDrawerProviderState = 'loading' | 'ready' | 'empty' | 'unavailable';

/** Shared state wrapper for provider adapters so migrations keep consistent drawer semantics. */
export const EntityDrawerProviderStatus = ({
  state,
  children,
  emptyMessage = 'Nothing to show.',
  unavailableMessage = 'This content is unavailable.'
}: {
  state: EntityDrawerProviderState;
  children?: ReactNode;
  emptyMessage?: string;
  unavailableMessage?: string;
}) => {
  if (state === 'ready') return children;
  const message =
    state === 'loading' ? 'Loading…' : state === 'empty' ? emptyMessage : unavailableMessage;
  return <span className="dim">{message}</span>;
};

export type EntityDrawerProviderProps = {
  context: EntityDrawerProviderContext;
  item: Extract<EntityDrawerItem, { kind: 'slot' }>;
  label: string;
};

export type EntityDrawerProviderDefinition = {
  slotId: string;
  supports: (context: EntityDrawerProviderContext) => boolean;
  Component: ComponentType<EntityDrawerProviderProps>;
};

export type EntityDrawerProviderRegistry = {
  definitions: readonly EntityDrawerProviderDefinition[];
  get: (slotId: string) => EntityDrawerProviderDefinition | undefined;
};

export const createEntityDrawerProviderRegistry = (
  definitions: readonly EntityDrawerProviderDefinition[]
): EntityDrawerProviderRegistry => {
  const bySlot = new Map<string, EntityDrawerProviderDefinition>();
  for (const definition of definitions) {
    if (bySlot.has(definition.slotId)) {
      throw new Error(`Duplicate entity drawer provider slot '${definition.slotId}'.`);
    }
    bySlot.set(definition.slotId, definition);
  }

  return {
    definitions,
    get: slotId => bySlot.get(slotId)
  };
};

/**
 * Application migrations extend this list with providers that keep their existing queries and
 * calculations. The generic renderer deliberately knows nothing about application-specific data.
 */
export const ENTITY_DRAWER_PROVIDER_DEFINITIONS: readonly EntityDrawerProviderDefinition[] = [];

export const entityDrawerProviderRegistry = createEntityDrawerProviderRegistry(
  ENTITY_DRAWER_PROVIDER_DEFINITIONS
);
