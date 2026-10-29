import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { DateRangeTimelineWidgetConfig } from './types';

type DateRangeTimelineConfigFormProps = {
  config: DateRangeTimelineWidgetConfig;
  onChange: (config: DateRangeTimelineWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

const TextOption = ({
  label,
  value,
  placeholder,
  onChange
}: {
  label: string;
  value: string | undefined;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}) => (
  <FormGrid.Row label={label}>
    <TextInput
      value={value ?? ''}
      placeholder={placeholder}
      style={{ width: '100%' }}
      onChange={v => onChange(optionalText(v))}
    />
  </FormGrid.Row>
);

export const DateRangeTimelineConfigForm = ({
  config,
  onChange
}: DateRangeTimelineConfigFormProps) => (
  <>
    <FormGroup
      label="Records (query)"
      supplementaryLabel={config.entityQuery === undefined ? undefined : '(optional)'}
      variant="simple"
    >
      <TextInput
        value={config.query ?? ''}
        placeholder='e.g. schema:"Contract"'
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, query: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Start field id" variant="simple">
      <TextInput
        value={config.startFieldId}
        placeholder="e.g. contract_start"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, startFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="End field id" variant="simple">
      <TextInput
        value={config.endFieldId}
        placeholder="e.g. contract_end"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, endFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <TextOption
          label="Subtitle field id"
          value={config.sublabelFieldId}
          onChange={sublabelFieldId => onChange({ ...config, sublabelFieldId })}
        />
        <TextOption
          label="Value field id"
          value={config.valueFieldId}
          onChange={valueFieldId => onChange({ ...config, valueFieldId })}
        />
        <TextOption
          label="Marker offset field id"
          value={config.markerOffsetFieldId}
          placeholder="Duration before end, e.g. notice_period"
          onChange={markerOffsetFieldId => onChange({ ...config, markerOffsetFieldId })}
        />
        <TextOption
          label="Marker only when field id"
          value={config.markerWhenFieldId}
          placeholder="Boolean field, e.g. auto_renew"
          onChange={markerWhenFieldId => onChange({ ...config, markerWhenFieldId })}
        />
      </FormGrid>
    </FormGroup>
  </>
);
