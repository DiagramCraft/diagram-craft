import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../../sections/entities/entityDrawer/useEntityDrawer';
import { useNeedsAttentionQueue } from './needsAttentionQueue';
import { NeedsAttentionList } from './NeedsAttentionList';
import { NeedsAttentionWidgetConfig } from './types';

type Props = {
  config: NeedsAttentionWidgetConfig;
};

export const NeedsAttentionWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();

  const queue = useNeedsAttentionQueue(workspaceSlug, {
    schemaId: config.schema,
    caseKinds: config.caseKinds,
    scope: config.scope
  });

  return (
    <NeedsAttentionList
      items={queue.items}
      isLoading={queue.isLoading}
      isError={queue.isError}
      severity={config.severity}
      limit={config.limit}
      onOpenEntity={openEntityDrawer}
    />
  );
};

export const isScope = (value: unknown): value is NeedsAttentionWidgetConfig['scope'] =>
  value === 'workspace' || value === 'mine' || value === 'late';

export const isSeverity = (value: unknown): value is NeedsAttentionWidgetConfig['severity'] =>
  value === 'none' || value === 'due-date';
