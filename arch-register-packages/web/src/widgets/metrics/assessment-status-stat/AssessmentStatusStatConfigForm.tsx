import { DialogSection } from '../../../sections/markdown/editor/BlockDialog';
import { AssessmentSchemaConfigForm } from '../../shared/data/AssessmentSchemaConfigForm';
import registrationStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import { AssessmentStatusStatConfig } from './types';

export const ConfigForm = ({
  config,
  onChange
}: {
  config: AssessmentStatusStatConfig;
  onChange: (config: AssessmentStatusStatConfig) => void;
}) => (
  <>
    <AssessmentSchemaConfigForm config={config} onChange={onChange} statusRequired />
    <DialogSection label="Subtext" required={false}>
      <div className={registrationStyles.options}>
        <label className={registrationStyles.optionRow}>
          <span className={registrationStyles.optionLabel}>Template</span>
          <div className={registrationStyles.optionControl}>
            <input
              type="text"
              className={registrationStyles.labelInput}
              value={config.subtextTemplate ?? ''}
              placeholder="e.g. of {total} assessments"
              onChange={event => {
                const value = event.currentTarget.value;
                onChange({ ...config, subtextTemplate: value.trim() === '' ? undefined : value });
              }}
            />
          </div>
        </label>
      </div>
    </DialogSection>
  </>
);
