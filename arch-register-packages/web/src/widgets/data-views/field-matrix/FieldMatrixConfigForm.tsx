import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { FormGroup } from '../../../components/FormGroup';
import { FormGrid } from '../../../components/FormGrid';
import { FieldMatrixWidgetConfig } from './types';

type FieldMatrixConfigFormProps = {
  config: FieldMatrixWidgetConfig;
  onChange: (config: FieldMatrixWidgetConfig) => void;
};

const optionalText = (value: string | undefined): string | undefined =>
  (value ?? '').trim() === '' ? undefined : value;

const parseRows = (text: string): number[] =>
  text
    .split(',')
    .filter(part => part.trim() !== '')
    .map(part => Number(part.trim()))
    .filter(value => Number.isFinite(value));

export const FieldMatrixConfigForm = ({ config, onChange }: FieldMatrixConfigFormProps) => (
  <>
    <FormGroup label="Records (query)" variant="simple">
      <TextInput
        value={config.query ?? ''}
        placeholder='e.g. schema:"Vendor"'
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, query: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Row field id" variant="simple">
      <TextInput
        value={config.rowFieldId}
        placeholder="e.g. criticality"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, rowFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Row values, top to bottom" variant="simple">
      <TextInput
        value={config.rows.join(', ')}
        placeholder="e.g. 5, 4, 3, 2"
        style={{ width: '100%' }}
        onBlur={e => onChange({ ...config, rows: parseRows(e.currentTarget.value) })}
      />
    </FormGroup>
    <FormGroup label="Column field id" variant="simple">
      <TextInput
        value={config.valueFieldId}
        placeholder="e.g. risk"
        style={{ width: '100%' }}
        onChange={value => onChange({ ...config, valueFieldId: value ?? '' })}
      />
    </FormGroup>
    <FormGroup label="Display" supplementaryLabel="(optional)" variant="simple">
      <FormGrid>
        <FormGrid.Row label="Corner label">
          <TextInput
            value={config.cornerLabel ?? ''}
            style={{ width: '100%' }}
            onChange={value => onChange({ ...config, cornerLabel: optionalText(value) })}
          />
        </FormGrid.Row>
        <FormGrid.Row label="Emphasise hot bands from row">
          <NumberInput
            value={config.hotRowMin ?? ''}
            style={{ width: '80px' }}
            onChange={value => onChange({ ...config, hotRowMin: value })}
          />
        </FormGrid.Row>
      </FormGrid>
    </FormGroup>
    <FormGroup label="Bands (JSON: label, min, tone, hot)" variant="simple">
      <TextArea
        rows={6}
        value={JSON.stringify(config.bands, null, 2)}
        style={{ width: '100%' }}
        onBlur={e => {
          try {
            const parsed = JSON.parse(e.currentTarget.value);
            if (Array.isArray(parsed)) onChange({ ...config, bands: parsed });
          } catch {
            // Keep the previous bands until the text is valid JSON.
          }
        }}
      />
    </FormGroup>
  </>
);
