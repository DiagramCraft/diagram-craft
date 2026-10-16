import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FormCheckboxList } from '../../../components/FormCheckboxList';
import { GroupedRollupTableWidgetConfig } from './types';

type GroupedRollupTableConfigFormProps = {
  config: GroupedRollupTableWidgetConfig;
  onChange: (config: GroupedRollupTableWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

const Toggle = ({
  label,
  checked,
  onChange
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <FormCheckboxList.Row label={label}>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
  </FormCheckboxList.Row>
);

export const GroupedRollupTableConfigForm = ({
  config,
  onChange
}: GroupedRollupTableConfigFormProps) => (
  <>
    <FormGroup label="Records (query)" variant="simple">
      <TextInput
        value={config.query ?? ''}
        placeholder='e.g. schema:"Vendor"'
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, query: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Sum field id" variant="simple">
      <TextInput
        value={config.valueFieldId}
        placeholder="e.g. spend"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, valueFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Group by field id">
          <TextInput
            value={config.groupFieldId ?? ''}
            placeholder="Blank = one row per record"
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, groupFieldId: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Group column title">
          <TextInput
            value={config.groupLabel ?? ''}
            placeholder="Name"
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, groupLabel: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Value column title">
          <TextInput
            value={config.valueLabel ?? ''}
            placeholder="Total"
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, valueLabel: optionalText(value) })}
          />
        </FormGrid.Row>
      </FormGrid>
      <FormCheckboxList>
        <Toggle
          label="Bars"
          checked={config.showBar ?? false}
          onChange={checked => onChange({ ...config, showBar: checked || undefined })}
        />
        <Toggle
          label="Share %"
          checked={config.showPercent ?? false}
          onChange={checked => onChange({ ...config, showPercent: checked || undefined })}
        />
        <Toggle
          label="Record count"
          checked={config.showCount ?? false}
          onChange={checked => onChange({ ...config, showCount: checked || undefined })}
        />
        <Toggle
          label="Total row"
          checked={config.showTotal ?? true}
          onChange={checked => onChange({ ...config, showTotal: checked ? undefined : false })}
        />
      </FormCheckboxList>
    </FormGroup>
  </>
);
