import { type ConfigFormProps } from '../../shared/types';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { WikiPagePicker } from './WikiPagePicker';
import { WikiPageWidgetConfig } from './types';

export const WikiPageDashboardConfigForm = ({
  config,
  onChange,
  context
}: ConfigFormProps<WikiPageWidgetConfig>) => {
  const { workspaceSlug } = useWorkspaceContext();
  const { projectId } = useMdxContext();
  return (
    <DialogSection label="Wiki page">
      <WikiPagePicker
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        surface={context.surface}
        value={config.nodeId}
        onChange={nodeId => onChange({ ...config, nodeId })}
      />
    </DialogSection>
  );
};
