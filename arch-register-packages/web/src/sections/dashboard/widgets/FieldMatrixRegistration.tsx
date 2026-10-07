import { TbGrid4X4 } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { FieldMatrixConfigForm } from './FieldMatrixConfigForm';
import {
  FieldMatrixWidget,
  isFieldMatrixConfigComplete,
  type FieldMatrixWidgetConfig
} from './FieldMatrixWidget';

export const FIELD_MATRIX_TYPE = 'FieldMatrix' as const;

const optionalString = (value: unknown): boolean =>
  value === undefined || typeof value === 'string';

const TONES = ['good', 'warn', 'bad', 'neutral'];

const isBand = (band: unknown): boolean => {
  const value = band as Record<string, unknown> | null;
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.label === 'string' &&
    typeof value.min === 'number' &&
    typeof value.tone === 'string' &&
    TONES.includes(value.tone) &&
    (value.hot === undefined || typeof value.hot === 'boolean')
  );
};

export const fieldMatrixSpec: DashboardWidgetSpec<FieldMatrixWidgetConfig> = {
  icon: TbGrid4X4,
  label: 'Field matrix',
  description:
    'Records placed in a grid of numeric row values against banded numeric values, with clickable record chips.',
  defaultW: 6,
  defaultH: 20,
  surfaces: ['workspace', 'project'],
  component: FieldMatrixWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is FieldMatrixWidgetConfig =>
    typeof config.rowFieldId === 'string' &&
    typeof config.valueFieldId === 'string' &&
    Array.isArray(config.rows) &&
    config.rows.every(row => typeof row === 'number') &&
    Array.isArray(config.bands) &&
    config.bands.every(isBand) &&
    optionalString(config.query) &&
    optionalString(config.schemaName) &&
    optionalString(config.cornerLabel) &&
    optionalString(config.label) &&
    (config.hotRowMin === undefined || typeof config.hotRowMin === 'number') &&
    isFieldMatrixConfigComplete(config as FieldMatrixWidgetConfig),
  createDefaultConfig: () => ({
    query: '',
    rowFieldId: '',
    rows: [3, 2, 1],
    valueFieldId: '',
    bands: [
      { label: 'Low', min: 0, tone: 'good' },
      { label: 'High', min: 3, tone: 'bad' }
    ]
  }),
  getTitle: config => config.label?.trim() || 'Field matrix',
  configForm: FieldMatrixConfigForm
};
