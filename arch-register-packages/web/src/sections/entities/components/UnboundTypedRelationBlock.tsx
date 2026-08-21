import type { EntitySchema, TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { computeUnboundRelationEndpoints } from '../../../lib/unboundTypedRelations';
import type { TypedRelationFieldEditState } from '../../../lib/entityEditState';
import { RelationRecordList } from './RelationRecordList';
import { TypedRelationFieldEditor } from './TypedRelationFieldEditor';
import styles from './EntityOverviewTab.module.css';

type UnboundTypedRelationBlockProps = {
  schema: EntitySchema | null;
  relationSchema: RelationSchema;
  editing: boolean;
  workspaceSlug: string;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  unboundRelationFieldId: (relationSchemaId: string, direction: 'in' | 'out') => string;
  getTypedRelationFieldState: (fieldId: string) => TypedRelationFieldEditState;
  updateUnboundTypedRelation: (
    relationSchema: RelationSchema,
    direction: 'in' | 'out',
    updater: (state: TypedRelationFieldEditState) => void
  ) => void;
};

/** Renders the (possibly two-directional) instances of a relation schema with no dedicated field. */
export const UnboundTypedRelationBlock = ({
  schema,
  relationSchema,
  editing,
  workspaceSlug,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  unboundRelationFieldId,
  getTypedRelationFieldState,
  updateUnboundTypedRelation
}: UnboundTypedRelationBlockProps) => {
  const endpoints = computeUnboundRelationEndpoints(
    schema,
    relationSchema,
    typedRelationsOutgoing,
    typedRelationsIncoming
  );

  return (
    <>
      {endpoints.map(({ endpointDirection, direction, label, records }) => {
        const field: TypedRelationField = {
          id: unboundRelationFieldId(relationSchema.id, endpointDirection),
          name: label,
          requirementLevel: null,
          type: 'typedRelation',
          relationSchemaId: relationSchema.id,
          direction: endpointDirection,
          minCount: 0,
          maxCount: -1
        };
        const fieldState = getTypedRelationFieldState(field.id);

        return (
          <div key={endpointDirection} className={styles.unboundRelationGroup}>
            {editing ? (
              <TypedRelationFieldEditor
                workspaceId={workspaceSlug}
                field={field}
                relationSchema={relationSchema}
                existingRecords={records}
                fieldState={fieldState}
                onCreate={draft =>
                  updateUnboundTypedRelation(relationSchema, endpointDirection, state => {
                    state.create.push(draft);
                  })
                }
                onRemoveDraft={index =>
                  updateUnboundTypedRelation(relationSchema, endpointDirection, state => {
                    state.create.splice(index, 1);
                  })
                }
                onUpdateField={(relationUid, fieldId, value) =>
                  updateUnboundTypedRelation(relationSchema, endpointDirection, state => {
                    const existing = state.update.get(relationUid) ?? {};
                    state.update.set(relationUid, { ...existing, [fieldId]: value });
                  })
                }
                onToggleRemove={relationUid =>
                  updateUnboundTypedRelation(relationSchema, endpointDirection, state => {
                    if (state.remove.has(relationUid)) state.remove.delete(relationUid);
                    else state.remove.add(relationUid);
                  })
                }
              />
            ) : records.length > 0 ? (
              <RelationRecordList
                records={records}
                direction={direction}
                relationSchema={relationSchema}
                workspaceId={workspaceSlug}
              />
            ) : (
              <div className={styles.unboundRelationEmpty}>No relation instances</div>
            )}
          </div>
        );
      })}
    </>
  );
};
