import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { AssessmentSchemaConfigForm } from '../../shared/data/AssessmentSchemaConfigForm';
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
    <FormGroup label="Subtext" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Template">
          <TextInput
            value={config.subtextTemplate ?? ''}
            placeholder="e.g. of {total} assessments"
            style={{ width: '100%' }}
            onChange={value =>
              onChange({
                ...config,
                subtextTemplate: (value ?? '').trim() === '' ? undefined : value
              })
            }
          />
        </FormGrid.Row>
      </FormGrid>
    </FormGroup>
  </>
);
