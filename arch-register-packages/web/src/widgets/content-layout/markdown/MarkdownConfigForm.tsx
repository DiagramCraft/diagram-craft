import { TextArea } from '@diagram-craft/app-components/TextArea';
import { FormGroup } from '../../../components/FormGroup';
import { MarkdownWidgetConfig } from './types';

type MarkdownDashboardConfigFormProps = {
  config: MarkdownWidgetConfig;
  onChange: (config: MarkdownWidgetConfig) => void;
};

export const MarkdownDashboardConfigForm = ({
  config,
  onChange
}: MarkdownDashboardConfigFormProps) => (
  <>
    <FormGroup label="Markdown" variant="simple">
      <TextArea
        value={config.markdown}
        onChange={value => onChange({ ...config, markdown: value ?? '' })}
        placeholder="Write Markdown…"
        rows={12}
        style={{ width: '100%' }}
      />
    </FormGroup>
  </>
);
