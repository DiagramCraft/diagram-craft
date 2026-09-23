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
  typedRelationsStatus: {
    isLoading: boolean;
    isError: boolean;
  };
  openEntity: (entityId: string) => void;
  openGovernanceCase?: (caseId: string) => void;
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
  showLabel?: boolean;
  presentation?: 'row' | 'mini-panel';
};

export type EntityDrawerRequiredField = {
  id: string;
  type?: EntitySchema['fields'][number]['type'];
};

export type EntityDrawerProviderDefinition = {
  slotId: string;
  supports?: (context: EntityDrawerProviderContext) => boolean;
  requiredFields?: readonly EntityDrawerRequiredField[];
  Component: ComponentType<EntityDrawerProviderProps>;
};

export const schemaHasRequiredFields = (
  schema: EntitySchema,
  requiredFields: readonly EntityDrawerRequiredField[]
): boolean =>
  requiredFields.every(required =>
    schema.fields.some(
      field => field.id === required.id && (required.type === undefined || field.type === required.type)
    )
  );

export const providerSupportsContext = (
  definition: EntityDrawerProviderDefinition,
  context: EntityDrawerProviderContext
): boolean => {
  if (definition.supports) return definition.supports(context);
  if (definition.requiredFields) return schemaHasRequiredFields(context.schema, definition.requiredFields);
  return true;
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
