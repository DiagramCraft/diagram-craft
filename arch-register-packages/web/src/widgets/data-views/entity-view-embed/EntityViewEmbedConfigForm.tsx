import { useSavedViews } from '../../../hooks/useSavedViews';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import type { ConfigFormProps } from '../../shared/types';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { SavedViewSelectField } from './SavedViewSelectField';
import type { SavedViewEmbedWidgetConfig } from './types';

type Props = ConfigFormProps<SavedViewEmbedWidgetConfig>;

export const EntityViewEmbedConfigForm = ({ config, onChange }: Props) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();
  const { data: savedViews = [] } = useSavedViews(workspaceSlug, {
    projectId,
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
