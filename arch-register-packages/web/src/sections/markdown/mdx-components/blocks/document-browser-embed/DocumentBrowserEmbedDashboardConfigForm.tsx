import { DialogSection } from '../../../editor/BlockDialog';
import { DocumentBrowserEmbedConfigForm } from './DocumentBrowserEmbedConfigForm';
import type { DocumentBrowserEmbedConfig } from './types';

type Props = {
  config: DocumentBrowserEmbedConfig;
  onChange: (config: DocumentBrowserEmbedConfig) => void;
};

export const DocumentBrowserEmbedDashboardConfigForm = ({ config, onChange }: Props) => (
  <DialogSection label="Filters" required={false}>
    <DocumentBrowserEmbedConfigForm value={config} onChange={onChange} />
  </DialogSection>
);
