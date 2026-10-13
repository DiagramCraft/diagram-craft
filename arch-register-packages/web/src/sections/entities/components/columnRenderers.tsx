import type { ReactNode } from 'react';
import type { ColumnRenderConfig } from '@arch-register/api-types/viewContract';
import { bandTone, toneColor, type BandTone, type ColourBand } from '../../../components/bandColor';
import {
  isNumericDisplayField,
  PROJECTION_FIELD_PREFIX,
  type EntityDisplayField
} from './entityDisplayFields';
import styles from './columnRenderers.module.css';

type RenderType = ColumnRenderConfig['type'];

export type ColumnRenderContext = {
  value: string | number | null;
  /** Formatted display text, used as the label by every renderer. */
  text: string | null;
  field: EntityDisplayField;
};

type ColumnRendererSpec = {
  label: string;
  isApplicable: (field: EntityDisplayField) => boolean;
  defaultConfig: (field: EntityDisplayField) => ColumnRenderConfig;
  render: (context: ColumnRenderContext, config: ColumnRenderConfig) => ReactNode;
};

const isSelectField = (field: EntityDisplayField) => {
  const schemaField = field.schemaField;
  return (
    schemaField?.type === 'select' ||
    (schemaField?.type === 'derived' && schemaField.resultType === 'select')
  );
};

const isDateField = (field: EntityDisplayField) => field.schemaField?.type === 'date';

const isNumberLike = (field: EntityDisplayField) =>
  isNumericDisplayField(field) ||
  field.id === '_completeness' ||
  field.id === '_usageCount' ||
  field.id.startsWith(PROJECTION_FIELD_PREFIX) ||
  field.assessmentField?.type === 'rating';

const MS_PER_DAY = 86_400_000;

/** Numbers as-is; dates as whole days from today (negative = past); anything else null. */
export const toNumericValue = (
  value: string | number | null,
  field: EntityDisplayField,
  now: number = Date.now()
): number | null => {
  if (value == null) return null;
  if (typeof value === 'number') return value;
  if (isDateField(field)) {
    const time = Date.parse(value);
    return Number.isNaN(time) ? null : Math.round((time - now) / MS_PER_DAY);
  }
  const parsed = Number(value);
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;
};

export const barFraction = (value: number, min = 0, max = 100): number => {
  if (max <= min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
};

export const resolveBandTone = (
  { value, field }: Pick<ColumnRenderContext, 'value' | 'field'>,
  config: Extract<ColumnRenderConfig, { type: 'colorBand' }>,
  now?: number
): BandTone | null => {
  if (value == null) return null;
  if (config.options) return config.options[String(value)] ?? null;
  const numeric = toNumericValue(value, field, now);
  if (numeric == null || !config.bands?.length) return null;
  return bandTone(numeric, config.bands as ColourBand[]);
};

const DEFAULT_BANDS: ColourBand[] = [
  { max: 33, tone: 'bad' },
  { max: 66, tone: 'warn' },
  { max: null, tone: 'good' }
];

const empty = <span className="dim">—</span>;

export const COLUMN_RENDERERS: Record<RenderType, ColumnRendererSpec> = {
  plain: {
    label: 'Plain',
    isApplicable: () => true,
    defaultConfig: () => ({ type: 'plain' }),
    render: ({ text }) => <span className="dim">{text ?? '—'}</span>
  },
  colorBand: {
    label: 'Color band',
    isApplicable: field => isSelectField(field) || isNumberLike(field) || isDateField(field),
    defaultConfig: field =>
      isSelectField(field)
        ? {
            type: 'colorBand',
            options: Object.fromEntries(
              (field.schemaField && 'options' in field.schemaField
                ? (field.schemaField.options ?? [])
                : []
              ).map(option => [option.value, 'good' as BandTone])
            )
          }
        : { type: 'colorBand', bands: DEFAULT_BANDS },
    render: (context, config) => {
      if (config.type !== 'colorBand' || context.text == null) return empty;
      const tone = resolveBandTone(context, config);
      return (
        <span className={styles.band}>
          <span
            className={styles.dot}
            style={{ background: toneColor(tone ?? 'neutral') }}
            aria-hidden
          />
          {context.text}
        </span>
      );
    }
  },
  bar: {
    label: 'Bar',
    isApplicable: field => isNumberLike(field),
    defaultConfig: () => ({ type: 'bar', min: 0, max: 100 }),
    render: ({ value, text, field }, config) => {
      if (config.type !== 'bar') return empty;
      const numeric = toNumericValue(value, field);
      if (numeric == null || text == null) return empty;
      const fraction = barFraction(numeric, config.min, config.max);
      return (
        <span className={styles.bar}>
          <span className={styles.track} aria-hidden>
            <span className={styles.fill} style={{ width: `${fraction * 100}%` }} />
          </span>
          <span className={styles.barLabel}>{text}</span>
        </span>
      );
    }
  }
};

export const renderColumnValue = (context: ColumnRenderContext, config: ColumnRenderConfig) => {
  const spec = COLUMN_RENDERERS[config.type] ?? COLUMN_RENDERERS.plain;
  return spec.isApplicable(context.field)
    ? spec.render(context, config)
    : COLUMN_RENDERERS.plain.render(context, config);
};

/** Whether more than one renderer applies to the column, i.e. whether there is anything to configure. */
export const hasColumnRendererChoice = (field: EntityDisplayField): boolean =>
  Object.values(COLUMN_RENDERERS).filter(spec => spec.isApplicable(field)).length > 1;
