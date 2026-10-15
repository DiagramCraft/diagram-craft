import { useState } from 'react';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
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
      <DialogSection label="Entity">
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
      </DialogSection>
      <DialogSection label="Relation groups" required={false}>
        <div className={configFormStyles.options}>
          <div className={`${configFormStyles.hint} dim`}>
            Optional. Limit the radius to typed-relation fields and show one column per field.
          </div>
          {groups.map((group, index) => (
            <div key={index} className={configFormStyles.optionRow}>
              <input
                type="text"
                className={configFormStyles.labelInput}
                value={group.fieldName}
                placeholder="Relation field"
                onChange={event => patchGroup(index, { fieldName: event.currentTarget.value })}
              />
              <input
                type="text"
                className={configFormStyles.labelInput}
                value={group.label}
                placeholder="Column heading"
                onChange={event => patchGroup(index, { label: event.currentTarget.value })}
              />
              <button
                type="button"
                className={configFormStyles.labelInput}
                onClick={() => setGroups(groups.filter((_, i) => i !== index))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className={configFormStyles.labelInput}
            onClick={() => setGroups([...groups, { fieldName: '', label: '' }])}
          >
            Add group
          </button>
          {groups.length > 0 && (
            <label className={configFormStyles.optionRow}>
              <span className={configFormStyles.optionLabel}>Depth</span>
              <div className={configFormStyles.optionControl}>
                <input
                  type="number"
                  min={1}
                  max={3}
                  className={configFormStyles.labelInput}
                  value={config.maxDepth ?? 2}
                  onChange={event =>
                    commit({
                      ...config,
                      maxDepth: Math.min(3, Math.max(1, Number(event.currentTarget.value) || 2))
                    })
                  }
                />
              </div>
            </label>
          )}
        </div>
      </DialogSection>
    </>
  );
};
