import { useState, useEffect, useMemo } from 'react';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormGroup } from '@diagram-craft/app-components/FormGroup';
import { Select } from '@diagram-craft/app-components/Select';
import { Banner } from '../components/Banner';
import styles from './AddEntityDialog.module.css';
import { useEntitiesBySchema } from '../hooks/useEntities';
import { useCreateRelation } from '../hooks/useRelations';
import { useFieldGroupAccess } from '../auth/useFieldGroupAccess';
import { resolveGroupAccessControl } from '../lib/fieldGroupAccess';
import { RelationFieldInput } from './RelationFieldInput';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { TbAdjustments } from 'react-icons/tb';
import { ApiError } from '../lib/http';

type AddRelationDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  workspaceId: string;
  relationSchemas: RelationSchema[];
  fixedEntityId: string;
  fixedEntityName: string;
  fixedEntitySchemaId: string;
  /** Which endpoint the fixed entity occupies: 'in' for outgoing relations, 'out' for incoming. */
  fixedEndpoint: 'in' | 'out';
};

export const AddRelationDialog = ({
  open,
  onClose,
  onCreated,
  workspaceId,
  relationSchemas,
  fixedEntityId,
  fixedEntityName,
  fixedEntitySchemaId,
  fixedEndpoint
}: AddRelationDialogProps) => {
  const otherEndpoint = fixedEndpoint === 'in' ? 'out' : 'in';

  const eligibleRelationSchemas = useMemo(
    () => relationSchemas.filter(rs => rs[fixedEndpoint].schemaIds.includes(fixedEntitySchemaId)),
    [relationSchemas, fixedEndpoint, fixedEntitySchemaId]
  );

  const [relationSchemaId, setRelationSchemaId] = useState('');
  const [otherEntityId, setOtherEntityId] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setRelationSchemaId(eligibleRelationSchemas[0]?.id ?? '');
      setOtherEntityId('');
      setFields({});
      setError('');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }
  }, [open]);

  const selectedRelationSchema = eligibleRelationSchemas.find(rs => rs.id === relationSchemaId);
  const otherSchemaIds = selectedRelationSchema?.[otherEndpoint].schemaIds ?? [];
  const otherEntityQueries = useEntitiesBySchema(workspaceId, otherSchemaIds);
  const otherEntityCandidates = otherEntityQueries.flatMap(query => query.data ?? []);

  const getFieldGroupAccess = useFieldGroupAccess(workspaceId);
  const fieldAccessById = useMemo(() => {
    if (!selectedRelationSchema) return new Map<string, ReturnType<typeof getFieldGroupAccess>>();
    const groupAccessById = new Map(
      selectedRelationSchema.groups.map(group => [
        group.id,
        getFieldGroupAccess(
          resolveGroupAccessControl(group, selectedRelationSchema.shared_field_group_links ?? [])
        )
      ])
    );
    return new Map(
      selectedRelationSchema.fields.map(f => [
        f.id,
        f.groupId ? (groupAccessById.get(f.groupId) ?? 'edit') : 'edit'
      ])
    );
  }, [selectedRelationSchema, getFieldGroupAccess]);

  const createRelation = useCreateRelation(workspaceId);

  const setField = (id: string, value: string) => setFields(f => ({ ...f, [id]: value }));

  const handleSubmit = async () => {
    if (!selectedRelationSchema) {
      setError('Please select a relation type');
      return;
    }
    if (!otherEntityId) {
      setError(`Please select the "${otherEndpoint}" entity`);
      return;
    }

    setSubmitting(true);
    setError('');

    const dataFields: Record<string, unknown> = {};
    for (const f of selectedRelationSchema.fields) {
      if (f.archived || fieldAccessById.get(f.id) === 'none') continue;
      const val = fields[f.id];
      if (val !== undefined && val !== '') {
        if (f.type === 'boolean') {
          dataFields[f.id] = val === 'true';
        } else if (f.type === 'number') {
          dataFields[f.id] = Number(val);
        } else {
          dataFields[f.id] = val;
        }
      }
    }

    const body = {
      _schemaId: selectedRelationSchema.id,
      _inEntityId: fixedEndpoint === 'in' ? fixedEntityId : otherEntityId,
      _outEntityId: fixedEndpoint === 'out' ? fixedEntityId : otherEntityId,
      ...dataFields
    };

    try {
      await createRelation.mutateAsync(body);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New relation"
      width="min(720px, calc(100vw - 48px))"
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: submitting ? 'Creating...' : 'Create relation',
          type: 'default',
          disabled: submitting,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <form
        className={styles.form}
        onSubmit={e => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <button type="submit" hidden />

        <FormElement label="Relation type" required>
          <Select.Root
            value={relationSchemaId || undefined}
            onChange={value => {
              setRelationSchemaId(value ?? '');
              setOtherEntityId('');
              setFields({});
            }}
            placeholder="Select a relation type"
            style={{ width: '100%' }}
          >
            {eligibleRelationSchemas.map(rs => (
              <Select.Item key={rs.id} value={rs.id}>
                {rs.name}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>

        <FormElement label={otherEndpoint === 'in' ? '"In" entity' : '"Out" entity'} required>
          <Select.Root
            value={otherEntityId || undefined}
            disabled={!selectedRelationSchema}
            onChange={value => setOtherEntityId(value ?? '')}
            placeholder="Select an entity"
            style={{ width: '100%' }}
          >
            {otherEntityCandidates.map(entity => (
              <Select.Item key={entity._uid} value={entity._uid}>
                {entity._name ?? entity._slug}
              </Select.Item>
            ))}
          </Select.Root>
        </FormElement>

        <div className={styles.field}>
          <label>{fixedEndpoint === 'in' ? '"In" entity' : '"Out" entity'}</label>
          <div className="dim">{fixedEntityName}</div>
        </div>

        {selectedRelationSchema && selectedRelationSchema.fields.length > 0 && (
          <FormGroup label="Fields" icon={<TbAdjustments size={12} />}>
            {selectedRelationSchema.fields
              .filter(f => !f.archived && fieldAccessById.get(f.id) !== 'none')
              .map(f => (
                <RelationFieldInput
                  key={f.id}
                  field={f}
                  value={fields[f.id] ?? ''}
                  onChange={v => setField(f.id, v)}
                  disabled={fieldAccessById.get(f.id) === 'view'}
                />
              ))}
          </FormGroup>
        )}

        {error && <Banner variant="error">{error}</Banner>}
      </form>
    </Dialog>
  );
};
