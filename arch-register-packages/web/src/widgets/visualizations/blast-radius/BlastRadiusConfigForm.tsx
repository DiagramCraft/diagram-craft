import { useState } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { EntityPicker } from '../../../components/EntityPicker';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntity } from '../../../hooks/useEntities';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
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
  const patchGroup = (
    index: number,
    patch: Partial<NonNullable<BlastRadiusWidgetConfig['groups']>[number]>
  ) => setGroups(groups.map((group, i) => (i === index ? { ...group, ...patch } : group)));

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
        <div className={`${configFormStyles.hint} dim`}>
          Optional. Limit the radius to typed-relation fields and show one column per field.
        </div>
        {groups.map((group, index) => (
          <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <TextInput
              value={group.fieldName}
              placeholder="Relation field"
              style={{ flex: 1 }}
              onChange={value => patchGroup(index, { fieldName: value ?? '' })}
            />
            <TextInput
              value={group.label}
              placeholder="Column heading"
              style={{ flex: 1 }}
              onChange={value => patchGroup(index, { label: value ?? '' })}
            />
            <Button
              variant="secondary"
              onClick={() => setGroups(groups.filter((_, i) => i !== index))}
            >
              Remove
            </Button>
          </div>
        ))}
        <div>
          <Button
            variant="secondary"
            onClick={() => setGroups([...groups, { fieldName: '', label: '' }])}
          >
            Add group
          </Button>
        </div>
        {groups.length > 0 && (
          <FormGrid>
            <FormGrid.Row label="Depth">
              <NumberInput
                min={1}
                max={3}
                value={config.maxDepth ?? 2}
                style={{ width: '80px' }}
                onChange={value =>
                  commit({ ...config, maxDepth: Math.min(3, Math.max(1, value || 2)) })
                }
              />
            </FormGrid.Row>
          </FormGrid>
        )}
      </FormGroup>
    </>
  );
};
