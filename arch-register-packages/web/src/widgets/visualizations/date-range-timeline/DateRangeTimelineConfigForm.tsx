import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { DateRangeTimelineWidgetConfig } from './types';

type DateRangeTimelineConfigFormProps = {
  config: DateRangeTimelineWidgetConfig;
  onChange: (config: DateRangeTimelineWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

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
  <label className={configFormStyles.optionRow}>
    <span className={configFormStyles.optionLabel}>{label}</span>
    <div className={configFormStyles.optionControl}>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={e => onChange(optionalText(e.target.value))}
      />
    </div>
  </label>
);

export const DateRangeTimelineConfigForm = ({
  config,
  onChange
}: DateRangeTimelineConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required={config.entityQuery === undefined}>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query ?? ''}
        placeholder='e.g. schema:"Contract"'
        onChange={e => onChange({ ...config, query: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Start field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.startFieldId}
        placeholder="e.g. contract_start"
        onChange={e => onChange({ ...config, startFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="End field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.endFieldId}
        placeholder="e.g. contract_end"
        onChange={e => onChange({ ...config, endFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
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
      </div>
    </DialogSection>
  </>
);
