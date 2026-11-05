import { useState } from 'react';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ListEditor } from '../../../components/ListEditor';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { EntityPicker } from '../../../components/EntityPicker';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import { BlastRadiusWidgetConfig } from './types';

export const BlastRadiusConfigForm = ({
  config,
  onChange
}: {
  config: BlastRadiusWidgetConfig;
  onChange: (config: BlastRadiusWidgetConfig) => void;
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [entityId, setEntityId] = useState(config.entityId ?? '');
  const { data: entity } = useEntity(workspaceSlug, entityId, entityId !== '');

  const commit = (next: BlastRadiusWidgetConfig) => onChange(next);

  const groups = config.groups ?? [];
  const setGroups = (next: NonNullable<BlastRadiusWidgetConfig['groups']>) =>
    commit({ ...config, groups: next.length > 0 ? next : undefined });

  return (
    <>
      <FormGroup label="Entity" variant="simple">
        <EntityPicker
          selectedEntityId={entityId}
          selectedEntity={entity}
          onSelectEntity={selected => {
            setEntityId(selected._publicId);
            commit({ ...config, entityId: selected._publicId });
          }}
          onClearEntity={() => {
            setEntityId('');
            commit({ ...config, entityId: undefined });
          }}
        />
      </FormGroup>
      <FormGroup label="Relation groups" supplementaryLabel="(optional)" variant="simple">
        <ListEditor
          items={groups}
          onChange={setGroups}
          createItem={() => ({ fieldName: '', label: '' })}
          addLabel="Add group"
          reorder="drag"
          removeLabel="Remove group"
          emptyMessage="Optional. Limit the radius to typed-relation fields and show one column per field."
          renderItem={(group, { update }) => (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <TextInput
                value={group.fieldName}
                placeholder="Relation field"
                style={{ flex: 1 }}
                onChange={value => update({ fieldName: value ?? '' })}
              />
              <TextInput
                value={group.label}
                placeholder="Column heading"
                style={{ flex: 1 }}
                onChange={value => update({ label: value ?? '' })}
              />
            </div>
          )}
        />

        <FormGrid>
          <FormGrid.Row label="Depth">
            <NumberInput
              min={1}
              max={3}
              value={config.maxDepth ?? 2}
              style={{ width: '80px' }}
              disabled={groups.length === 0}
              onChange={value =>
                commit({ ...config, maxDepth: Math.min(3, Math.max(1, value || 2)) })
              }
            />
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
