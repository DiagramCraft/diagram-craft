import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { UpcomingByDateWidgetConfig } from './types';

type UpcomingByDateConfigFormProps = {
  config: UpcomingByDateWidgetConfig;
  onChange: (config: UpcomingByDateWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

export const UpcomingByDateConfigForm = ({ config, onChange }: UpcomingByDateConfigFormProps) => (
  <>
    <FormGroup label="Records (query)" variant="simple">
      <TextInput
        value={config.query}
        placeholder='e.g. schema:"Contract"'
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, query: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Date field id" variant="simple">
      <TextInput
        value={config.dateFieldId}
        placeholder="e.g. contract_end"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, dateFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Within (days)">
          <NumberInput
            min={0}
            value={config.windowDays ?? ''}
            placeholder="No limit"
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, windowDays: value })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Show">
          <NumberInput
            min={1}
            max={50}
            value={config.limit ?? 7}
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, limit: Math.max(1, value ?? 7) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Subtitle field id">
          <TextInput
            value={config.sublabelFieldId ?? ''}
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, sublabelFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Value field id">
          <TextInput
            value={config.valueFieldId ?? ''}
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, valueFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
      </FormGrid>
      <FormCheckboxList>
        <FormCheckboxList.Row label="Include overdue">
          <input
            type="checkbox"
            checked={config.includeOverdue ?? false}
            onChange={e => onChange({ ...config, includeOverdue: e.target.checked || undefined })}
          />
        </FormCheckboxList.Row>
      </FormCheckboxList>
    </FormGroup>
  </>
);
