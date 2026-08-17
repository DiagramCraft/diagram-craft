import { useEffect, useMemo, useState } from 'react';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { Select } from '@diagram-craft/app-components/Select';
import { Banner } from '../components/Banner';
import { RelationFieldInput } from './RelationFieldInput';
import { useCreateRelation } from '../hooks/useRelations';
import { useEntities } from '../hooks/useEntities';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  currentEntityId: string;
  currentSchemaId: string;
  currentEntityName: string;
  relationSchemas: RelationSchema[];
  schemas: EntitySchema[];
};

const allowed = (endpoint: RelationSchema['in'], schemaId: string): boolean =>
  endpoint.schemaIds === 'any' || endpoint.schemaIds.includes(schemaId);

const toFieldValue = (
  field: RelationSchema['fields'][number],
  value: string | string[]
): unknown => {
  if (field.type === 'entityRelation') return Array.isArray(value) ? value : [];
  if (value === '') return null;
  if (field.type === 'boolean') return value === 'true';
  if (field.type === 'number') return Number(value);
  return value;
};

export const RelationCreateDialog = ({
  open,
  onClose,
  workspaceId,
  currentEntityId,
  currentSchemaId,
  currentEntityName,
  relationSchemas,
  schemas
}: Props) => {
  const createMutation = useCreateRelation(workspaceId);
  const availableRelations = useMemo(
    () =>
      relationSchemas.filter(
        relation => allowed(relation.in, currentSchemaId) || allowed(relation.out, currentSchemaId)
      ),
    [currentSchemaId, relationSchemas]
  );
  const [relationSchemaId, setRelationSchemaId] = useState('');
  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [target, setTarget] = useState<EntitySummary | null>(null);
  const [search, setSearch] = useState('');
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [error, setError] = useState('');

  const selectedRelation = availableRelations.find(relation => relation.id === relationSchemaId);
  const currentEndpoint = selectedRelation?.[direction];
  const otherEndpoint = direction === 'in' ? 'out' : 'in';
  const targetSchemaIds = useMemo(() => {
    if (!currentEndpoint || !allowed(currentEndpoint, currentSchemaId)) return [];
    return currentEndpoint && selectedRelation
      ? selectedRelation[otherEndpoint].schemaIds === 'any'
        ? schemas.map(schema => schema.id)
        : selectedRelation[otherEndpoint].schemaIds
      : [];
  }, [currentEndpoint, currentSchemaId, otherEndpoint, schemas, selectedRelation]);
  const targetQuery = useEntities(
    workspaceId,
    { schemaIds: targetSchemaIds, q: search, view: 'summary', limit: 20 },
    { enabled: open && targetSchemaIds.length > 0 }
  );
  const activeFields = (selectedRelation?.fields ?? []).filter(field => !field.archived);

  useEffect(() => {
    if (!open) return;
    const first = availableRelations[0];
    setRelationSchemaId(first?.id ?? '');
    setDirection(first && allowed(first.in, currentSchemaId) ? 'in' : 'out');
    setTarget(null);
    setSearch('');
    setValues({});
    setError('');
  }, [availableRelations, currentSchemaId, open]);

  const handleSave = async () => {
    if (!selectedRelation || !target) {
      setError('Choose a relation type and target entity.');
      return;
    }

    const data: Record<string, unknown> = {
      _schemaId: selectedRelation.id,
      _inEntityId: direction === 'in' ? currentEntityId : target._uid,
      _outEntityId: direction === 'in' ? target._uid : currentEntityId
    };
    for (const field of activeFields) {
      const value = values[field.id] ?? (field.type === 'entityRelation' ? [] : '');
      if (value !== '' && (!Array.isArray(value) || value.length > 0)) {
        data[field.id] = toFieldValue(field, value);
      }
    }

    setError('');
    try {
      await createMutation.mutateAsync(
        data as {
          _schemaId: string;
          _inEntityId: string;
          _outEntityId: string;
        }
      );
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to create relation');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add relation"
      sub={currentEntityName}
      width="min(520px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'secondary', onClick: onClose },
        {
          label: 'Create',
          type: 'default',
          onClick: handleSave,
          disabled: !selectedRelation || !target || createMutation.isPending
        }
      ]}
    >
      {availableRelations.length === 0 ? (
        <div className="dim">No typed relation schemas allow this entity type.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <FormElement label="Relation type">
            <Select.Root
              value={relationSchemaId || undefined}
              onChange={next => {
                const nextRelation = availableRelations.find(relation => relation.id === next);
                setRelationSchemaId(next ?? '');
                setDirection(
                  nextRelation && allowed(nextRelation.in, currentSchemaId) ? 'in' : 'out'
                );
                setTarget(null);
                setSearch('');
              }}
              placeholder="Choose a relation"
              style={{ width: '100%' }}
            >
              {availableRelations.map(relation => (
                <Select.Item key={relation.id} value={relation.id}>
                  {relation.name}
                </Select.Item>
              ))}
            </Select.Root>
          </FormElement>
          <FormElement label="Direction">
            <Select.Root
              value={direction}
              onChange={next => {
                setDirection((next ?? 'in') as 'in' | 'out');
                setTarget(null);
                setSearch('');
              }}
              style={{ width: '100%' }}
            >
              {selectedRelation && allowed(selectedRelation.in, currentSchemaId) && (
                <Select.Item value="in">Outgoing from this entity</Select.Item>
              )}
              {selectedRelation && allowed(selectedRelation.out, currentSchemaId) && (
                <Select.Item value="out">Incoming to this entity</Select.Item>
              )}
            </Select.Root>
          </FormElement>
          <FormElement label="Target entity" required>
            <Autocomplete
              items={targetQuery.data}
              value={search}
              onValueChange={value => {
                setSearch(value);
                setTarget(null);
              }}
              onSelect={entity => {
                setTarget(entity);
                setSearch(entity._name);
              }}
              getItemKey={entity => entity._uid}
              getItemLabel={entity => entity._name}
              renderItem={entity => (
                <>
                  <span>{entity._name}</span>
                  <span className="dim"> {entity._schema.name}</span>
                </>
              )}
              placeholder="Search for an entity…"
              ariaLabel="Search for a target entity"
              emptyMessage="No entities found"
              loading={targetQuery.isLoading}
              autoFocus
            />
          </FormElement>
          {activeFields.map(field => (
            <RelationFieldInput
              key={field.id}
              workspaceId={workspaceId}
              field={field}
              value={values[field.id] ?? (field.type === 'entityRelation' ? [] : '')}
              onChange={value => setValues(previous => ({ ...previous, [field.id]: value }))}
            />
          ))}
          {error && <Banner variant="error">{error}</Banner>}
        </div>
      )}
    </Dialog>
  );
};
