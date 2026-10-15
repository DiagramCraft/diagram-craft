import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { DateCalendarWidgetConfig } from './types';

type DateCalendarConfigFormProps = {
  config: DateCalendarWidgetConfig;
  onChange: (config: DateCalendarWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const DateCalendarConfigForm = ({ config, onChange }: DateCalendarConfigFormProps) => (
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
    <DialogSection label="Date field id" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.dateFieldId}
        placeholder="e.g. contract_end"
        onChange={e => onChange({ ...config, dateFieldId: e.target.value })}
      />
    </DialogSection>
    <DialogSection label="Display" required={false}>
      <div className={configFormStyles.options}>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Period</span>
          <div className={configFormStyles.optionControl}>
            <select
              value={config.period ?? 'month'}
              onChange={e =>
                onChange({ ...config, period: e.target.value === 'week' ? 'week' : 'month' })
              }
            >
              <option value="month">Month</option>
              <option value="week">Week</option>
            </select>
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Number of periods</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={configFormStyles.labelInput}
              value={config.periodCount ?? 12}
              onChange={e =>
                onChange({
                  ...config,
                  periodCount: Math.max(1, optionalNumber(e.target.value) ?? 12)
                })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Subtitle field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.sublabelFieldId ?? ''}
              onChange={e => onChange({ ...config, sublabelFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Value field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.valueFieldId ?? ''}
              onChange={e => onChange({ ...config, valueFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Warn within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.warnWithinDays ?? ''}
              placeholder="30"
              onChange={e =>
                onChange({ ...config, warnWithinDays: optionalNumber(e.target.value) })
              }
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
