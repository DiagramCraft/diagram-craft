import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import type { ConfigFormProps } from '../../shared/types';
import { Select } from '@diagram-craft/app-components/Select';
import { EntityPicker } from '../../../components/EntityPicker';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { useEntity } from '../../../hooks/useEntities';
import { normalizeEntityGraphDepth, normalizeEntityGraphDirection } from './types';
import type { EntityGraphWidgetConfig } from './types';

type Props = ConfigFormProps<EntityGraphWidgetConfig>;

export const EntityGraphConfigForm = ({ config, onChange }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: entity } = useEntity(workspaceSlug, config.entityId);
  const depth = normalizeEntityGraphDepth(config.depth);
  const direction = normalizeEntityGraphDirection(config.direction);

  return (
    <>
      <FormGroup label="Entity" variant="simple">
        <EntityPicker
          selectedEntityId={config.entityId}
          selectedEntity={entity}
          onSelectEntity={selected => onChange({ ...config, entityId: selected._publicId })}
          onClearEntity={() => onChange({ ...config, entityId: '' })}
        />
      </FormGroup>
      <FormGroup label="Options" supplementaryLabel="(optional)" variant="simple">
        <FormGrid>
          <FormGrid.Row label="Depth">
            <NumberInput
              value={depth}
              min={1}
              max={3}
              step={1}
              onChange={value => onChange({ ...config, depth: normalizeEntityGraphDepth(value) })}
              style={{ width: '64px' }}
            />
          </FormGrid.Row>
          <FormGrid.Row label="Direction">
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
          </FormGrid.Row>
        </FormGrid>
      </FormGroup>
    </>
  );
};
