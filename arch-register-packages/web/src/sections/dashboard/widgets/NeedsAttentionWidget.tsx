import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useEntityDrawer } from '../../entities/entityDrawer/useEntityDrawer';
import { useNeedsAttentionQueue, type NeedsAttentionScope, type NeedsAttentionSeverity } from './needsAttentionQueue';
import { NeedsAttentionList } from './NeedsAttentionList';

export type NeedsAttentionWidgetConfig = {
  schema: string;
  caseKinds: string[];
  scope: NeedsAttentionScope;
  severity: NeedsAttentionSeverity;
  limit: number;
  label?: string;
};

type Props = {
  config: NeedsAttentionWidgetConfig;
};

export const NeedsAttentionWidget = ({ config }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { openEntityDrawer } = useEntityDrawer();
  const hasConfig = !!config.schema && config.caseKinds.length > 0;

  const queue = useNeedsAttentionQueue(
    workspaceSlug,
    { schemaId: config.schema || null, caseKinds: config.caseKinds, scope: config.scope },
    hasConfig
  );

  if (!hasConfig) {
    return <div className="dim">This widget is not fully configured.</div>;
  }

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
