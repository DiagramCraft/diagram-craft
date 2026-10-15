import { useCallback, useMemo } from 'react';
import { useEntitiesByIds } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { scalarValues } from '../../../lib/scalarFieldValues';

/**
 * Resolves a secondary display text per record from `fieldId`. A reference/containment field shows
 * the target entity's name, any other field its scalar value(s) joined with ", ".
 */
export const useRecordSublabels = (
  records: Array<Record<string, unknown>>,
  fieldId: string | undefined
): ((record: Record<string, unknown>) => string | undefined) => {
  const { workspaceSlug, schemas } = useWorkspaceContext();

  const isReference = useMemo(() => {
    if (!fieldId) return false;
    const first = records[0];
    const schemaId = first?._schemaId ?? (first?._schema as { id?: string } | undefined)?.id;
    const type = schemas
      .find(schema => schema.id === schemaId)
      ?.fields.find(field => field.id === fieldId)?.type;
    return type === 'reference' || type === 'containment';
  }, [schemas, records, fieldId]);

  const referencedIds = useMemo(
    () =>
      isReference && fieldId
        ? records.flatMap(record =>
            scalarValues(record[fieldId]).filter(
              (value): value is string => typeof value === 'string'
            )
          )
        : [],
    [records, isReference, fieldId]
  );
  const referenced = useEntitiesByIds(workspaceSlug, referencedIds);

  return useCallback(
    record => {
      if (!fieldId) return undefined;
      const text = scalarValues(record[fieldId])
        .map(value =>
          isReference && typeof value === 'string'
            ? referenced.get(value)?.name
            : typeof value === 'string' || typeof value === 'number'
              ? String(value)
              : undefined
        )
        .filter((value): value is string => !!value)
        .join(', ');
      return text === '' ? undefined : text;
    },
    [fieldId, isReference, referenced]
  );
};
