import { type ConfigFormProps } from '../../shared/types';
import { useMdxContext } from '../../../sections/markdown/MdxContext';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { FormGroup } from '../../../components/FormGroup';
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
    <FormGroup label="Wiki page" variant="simple">
      <WikiPagePicker
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        surface={context.surface}
        value={config.nodeId}
        onChange={nodeId => onChange({ ...config, nodeId })}
      />
    </FormGroup>
  );
};
