import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import configFormStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { DateBucketChartWidgetConfig } from './types';

type DateBucketChartConfigFormProps = {
  config: DateBucketChartWidgetConfig;
  onChange: (config: DateBucketChartWidgetConfig) => void;
};

const optionalText = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value;

const optionalNumber = (value: string): number | undefined =>
  value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Number(value);

export const DateBucketChartConfigForm = ({ config, onChange }: DateBucketChartConfigFormProps) => (
  <>
    <DialogSection label="Records (query)" required>
      <input
        type="text"
        className={configFormStyles.labelInput}
        value={config.query}
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
          <span className={configFormStyles.optionLabel}>Sum field id</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="text"
              className={configFormStyles.labelInput}
              value={config.measureFieldId ?? ''}
              placeholder="Blank = count records"
              onChange={e => onChange({ ...config, measureFieldId: optionalText(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Months</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={1}
              max={36}
              className={configFormStyles.labelInput}
              value={config.bucketCount ?? 12}
              onChange={e => onChange({ ...config, bucketCount: optionalNumber(e.target.value) })}
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Urgent within (days)</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="number"
              min={0}
              className={configFormStyles.labelInput}
              value={config.urgentWithinDays ?? ''}
              onChange={e =>
                onChange({ ...config, urgentWithinDays: optionalNumber(e.target.value) })
              }
            />
          </div>
        </label>
        <label className={configFormStyles.optionRow}>
          <span className={configFormStyles.optionLabel}>Include overdue</span>
          <div className={configFormStyles.optionControl}>
            <input
              type="checkbox"
              checked={config.foldOverdue ?? false}
              onChange={e => onChange({ ...config, foldOverdue: e.target.checked || undefined })}
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
