import { EntityBrowserEmbedConfigForm } from './EntityBrowserEmbedConfigForm';
import type { EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';

type Props = {
  config: EntityBrowserEmbedConfig;
  onChange: (config: EntityBrowserEmbedConfig) => void;
  context: { projectId?: string };
};

export const EntityBrowserEmbedDashboardConfigForm = ({ config, onChange, context }: Props) => (
  <EntityBrowserEmbedConfigForm
    projectId={context.projectId}
    initialConfig={config}
    onChange={onChange}
  />
);
