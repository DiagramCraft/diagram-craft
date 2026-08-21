import type { Dispatch, SetStateAction } from 'react';
import {
  emptyTypedRelationFieldState,
  type TypedRelationEditState
} from '../../../lib/entityEditState';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema, TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { SupportedCurrency } from '@arch-register/api-types/workspaceConfigContract';
import type { RefLookup } from '../types/entityDetailTypes';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { FieldGroupAccess } from '@arch-register/permissions';
import { PropertyRow } from './PropertyRow';

type UseEntityFieldRenderersProps = {
  workspaceSlug: string;
  entity: EntityRecord;
  editing: boolean;
  editState: Record<string, unknown>;
  setEditState: Dispatch<SetStateAction<Record<string, unknown>>>;
  typedRelationEditState: TypedRelationEditState;
  setTypedRelationEditState: Dispatch<SetStateAction<TypedRelationEditState>>;
  validationErrors: Set<string>;
  setValidationErrors: Dispatch<SetStateAction<Set<string>>>;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  currencies: SupportedCurrency[];
  defaultCurrency: string;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
};

/**
 * Shared field-widget rendering logic used by both the legacy default layout and the configurable
 * layout renderer — a single place that knows how to turn a schema field into a `PropertyRow`,
 * and how typed-relation (bound and unbound) edit state is threaded through.
 */
export const useEntityFieldRenderers = ({
  workspaceSlug,
  entity,
  editing,
  editState,
  setEditState,
  typedRelationEditState,
  setTypedRelationEditState,
  validationErrors,
  setValidationErrors,
  refLookup,
  referenceOptions,
  currencies,
  defaultCurrency,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas
}: UseEntityFieldRenderersProps) => {
  const getTypedRelationFieldState = (fieldId: string) =>
    typedRelationEditState[fieldId] ?? emptyTypedRelationFieldState();

  const updateTypedRelationFieldState = (
    fieldId: string,
    updater: (state: ReturnType<typeof getTypedRelationFieldState>) => void,
    unboundRelation?: Pick<TypedRelationField, 'relationSchemaId' | 'direction'>
  ) => {
    setTypedRelationEditState(prev => {
      const current = prev[fieldId] ?? emptyTypedRelationFieldState();
      const next = {
        create: [...current.create],
        update: new Map(current.update),
        remove: new Set(current.remove),
        ...(current.relationSchemaId !== undefined
          ? { relationSchemaId: current.relationSchemaId }
          : {}),
        ...(current.direction !== undefined ? { direction: current.direction } : {})
      };
      if (unboundRelation) Object.assign(next, unboundRelation);
      updater(next);
      return { ...prev, [fieldId]: next };
    });
  };

  const unboundRelationFieldId = (relationSchemaId: string, direction: 'in' | 'out') =>
    `unbound:${relationSchemaId}:${direction}`;

  const updateUnboundTypedRelation = (
    relationSchema: RelationSchema,
    direction: 'in' | 'out',
    updater: (state: ReturnType<typeof getTypedRelationFieldState>) => void
  ) =>
    updateTypedRelationFieldState(unboundRelationFieldId(relationSchema.id, direction), updater, {
      relationSchemaId: relationSchema.id,
      direction
    });

  const renderPropertyRow = (
    f: EntitySchema['fields'][number],
    groupAccess: FieldGroupAccess = 'edit'
  ) => (
    <PropertyRow
      key={f.id}
      field={f}
      value={entity[f.id]}
      editing={editing && groupAccess !== 'view'}
      editValue={editState[f.id]}
      typedRelationsOutgoing={typedRelationsOutgoing}
      typedRelationsIncoming={typedRelationsIncoming}
      relationSchemas={relationSchemas}
      currencyOptions={currencies}
      defaultCurrency={defaultCurrency}
      workspaceSlug={workspaceSlug}
      typedRelationFieldState={getTypedRelationFieldState(f.id)}
      onTypedRelationCreate={draft =>
        updateTypedRelationFieldState(f.id, state => {
          state.create.push(draft);
        })
      }
      onTypedRelationRemoveDraft={index =>
        updateTypedRelationFieldState(f.id, state => {
          state.create.splice(index, 1);
        })
      }
      onTypedRelationUpdateField={(relationUid, subFieldId, value) =>
        updateTypedRelationFieldState(f.id, state => {
          const existing = state.update.get(relationUid) ?? {};
          state.update.set(relationUid, { ...existing, [subFieldId]: value });
        })
      }
      onTypedRelationToggleRemove={relationUid =>
        updateTypedRelationFieldState(f.id, state => {
          if (state.remove.has(relationUid)) state.remove.delete(relationUid);
          else state.remove.add(relationUid);
        })
      }
      onChange={v => {
        setEditState(s => ({ ...s, [f.id]: v }));
        if (validationErrors.has(f.id))
          setValidationErrors(s => {
            const n = new Set(s);
            n.delete(f.id);
            return n;
          });
      }}
      refLookup={refLookup}
      referenceOptions={referenceOptions}
      hasError={validationErrors.has(f.id)}
      externalMeta={entity._externalMetadata?.[f.id]}
    />
  );

  return {
    renderPropertyRow,
    getTypedRelationFieldState,
    unboundRelationFieldId,
    updateUnboundTypedRelation
  };
};
