import { useSavedViews } from '../../../../../hooks/useSavedViews';
import { DialogSection } from '../../../editor/BlockDialog';
import { SavedViewSelectField } from './SavedViewSelectField';
import type { SavedViewEmbedWidgetConfig } from './types';

type Props = {
  config: SavedViewEmbedWidgetConfig;
  onChange: (config: SavedViewEmbedWidgetConfig) => void;
  context: { workspaceSlug: string; projectId?: string };
};

export const EntityViewEmbedDashboardConfigForm = ({ config, onChange, context }: Props) => {
  const { data: savedViews = [] } = useSavedViews(context.workspaceSlug, {
    projectId: context.projectId,
    includeWorkspace: true
  });
  const adminViews = savedViews.filter(v => v.isAdminView);

  return (
    <DialogSection label="View">
      <SavedViewSelectField
        adminViews={adminViews}
        value={config.viewId}
        onChange={viewId => onChange({ viewId })}
      />
    </DialogSection>
  );
};
