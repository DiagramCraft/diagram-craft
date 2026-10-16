import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { DateBucketChartWidgetConfig } from './types';

type DateBucketChartConfigFormProps = {
  config: DateBucketChartWidgetConfig;
  onChange: (config: DateBucketChartWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

export const DateBucketChartConfigForm = ({ config, onChange }: DateBucketChartConfigFormProps) => (
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
        <FormGrid.Row label="Sum field id">
          <TextInput
            value={config.measureFieldId ?? ''}
            placeholder="Blank = count records"
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, measureFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Months">
          <NumberInput
            min={1}
            max={36}
            value={config.bucketCount ?? 12}
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, bucketCount: value })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Urgent within (days)">
          <NumberInput
            min={0}
            value={config.urgentWithinDays ?? ''}
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, urgentWithinDays: value })}
          />
        </FormGrid.Row>
      </FormGrid>
      <FormCheckboxList>
        <FormCheckboxList.Row label="Include overdue">
          <input
            type="checkbox"
            checked={config.foldOverdue ?? false}
            onChange={e => onChange({ ...config, foldOverdue: e.target.checked || undefined })}
          />
        </FormCheckboxList.Row>
      </FormCheckboxList>
    </FormGroup>
  </>
);
