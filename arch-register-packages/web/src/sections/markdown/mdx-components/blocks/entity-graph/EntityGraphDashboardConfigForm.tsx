import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { EntityPicker } from '../../../../../components/EntityPicker';
import { DialogSection } from '../../../editor/BlockDialog';
import { useEntity } from '../../../../../hooks/useEntities';
import { normalizeEntityGraphDepth, normalizeEntityGraphDirection } from './types';
import type { EntityGraphWidgetConfig } from './types';
import styles from '../../../../dashboard/WidgetConfigDialog.module.css';

type Props = {
  config: EntityGraphWidgetConfig;
  onChange: (config: EntityGraphWidgetConfig) => void;
  context: { workspaceSlug: string };
};

export const EntityGraphDashboardConfigForm = ({ config, onChange, context }: Props) => {
  const { data: entity } = useEntity(context.workspaceSlug, config.entityId);
  const depth = normalizeEntityGraphDepth(config.depth);
  const direction = normalizeEntityGraphDirection(config.direction);

  return (
    <>
      <DialogSection label="Entity">
        <EntityPicker
          selectedEntityId={config.entityId}
          selectedEntity={entity}
          onSelectEntity={selected => onChange({ ...config, entityId: selected._publicId })}
          onClearEntity={() => onChange({ ...config, entityId: '' })}
        />
      </DialogSection>
      <DialogSection label="Options" required={false}>
        <div className={styles.options}>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Depth</span>
            <div className={styles.optionControl}>
              <NumberInput
                value={depth}
                min={1}
                max={3}
                step={1}
                onChange={value => onChange({ ...config, depth: normalizeEntityGraphDepth(value) })}
                style={{ width: '64px' }}
              />
            </div>
          </label>
          <label className={styles.optionRow}>
            <span className={styles.optionLabel}>Direction</span>
            <div className={styles.optionControl}>
              <Select.Root
                value={direction}
                onChange={value =>
                  onChange({ ...config, direction: normalizeEntityGraphDirection(value) })
                }
              >
                <Select.Item value="both">Both directions</Select.Item>
                <Select.Item value="upstream">Upstream dependencies</Select.Item>
                <Select.Item value="downstream">Downstream impact</Select.Item>
              </Select.Root>
            </div>
          </label>
        </div>
      </DialogSection>
    </>
  );
};
