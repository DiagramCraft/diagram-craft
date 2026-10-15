import { useState } from 'react';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
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

  return (
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
  );
};
