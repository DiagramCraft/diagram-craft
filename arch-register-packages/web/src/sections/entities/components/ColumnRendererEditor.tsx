import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import type { ColumnRenderConfig } from '@arch-register/api-types/viewContract';
import type { BandTone } from '../../../components/bandColor';
import { COLUMN_RENDERERS } from './columnRenderers';
import type { EntityDisplayField } from './entityDisplayFields';
import styles from './EntityBrowser.module.css';

const TONES: { value: BandTone; label: string }[] = [
  { value: 'good', label: 'Green' },
  { value: 'warn', label: 'Amber' },
  { value: 'bad', label: 'Red' }
];

const RangeInput = ({
                      label,
                      value,
                      onChange
                    }: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) => (
  <div className={styles.rendererRow}>
    <span className={styles.rendererOptionLabel}>{label}</span>
    <div className={styles.rendererInput}>
      <NumberInput value={value ?? ''} onChange={onChange}/>
    </div>
  </div>
);

const toneLabel = (tone: BandTone) => TONES.find(t => t.value === tone)!.label;

const TONE_ORDER_NORMAL: BandTone[] = ['bad', 'warn', 'good'];
const TONE_ORDER_REVERSED: BandTone[] = ['good', 'warn', 'bad'];

const ToneSelect = ({
                      value,
                      onChange
                    }: {
  value: BandTone;
  onChange: (tone: BandTone) => void;
}) => (
  <Select.Root value={value} onChange={v => onChange((v as BandTone) ?? 'good')}>
    {TONES.map(tone => (
      <Select.Item key={tone.value} value={tone.value}>
        {tone.label}
      </Select.Item>
    ))}
  </Select.Root>
);

/** Per-column "render as" picker plus the settings of the chosen renderer. */
export const ColumnRendererEditor = ({
                                       field,
                                       config,
                                       onChange
                                     }: {
  field: EntityDisplayField;
  config: ColumnRenderConfig;
  onChange: (config: ColumnRenderConfig) => void;
}) => {
  const applicable = Object.entries(COLUMN_RENDERERS).filter(([, spec]) =>
    spec.isApplicable(field)
  );
  if (applicable.length <= 1) return null;

  return (
    <div className={styles.rendererEditor}>
      <div className={styles.rendererRow}>
        <span className={styles.rendererOptionLabel}>Type</span>
        <div className={styles.rendererInput}>
          <Select.Root
            value={config.type}
            onChange={value => {
              const type = (value ?? 'plain') as ColumnRenderConfig['type'];
              if (type !== config.type) onChange(COLUMN_RENDERERS[type].defaultConfig(field));
            }}
          >
            {applicable.map(([type, spec]) => (
              <Select.Item key={type} value={type}>
                {spec.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      </div>

      {config.type === 'bar' && (
        <>
          <RangeInput
            label="Min"
            value={config.min}
            onChange={min => onChange({ ...config, min })}
          />
          <RangeInput
            label="Max"
            value={config.max}
            onChange={max => onChange({ ...config, max })}
          />
        </>
      )}

      {config.type === 'colorBand' && config.options && (
        <>
          {Object.entries(config.options).map(([option, tone]) => (
            <div key={option} className={styles.rendererRow}>
              <span className={styles.rendererOptionLabel}>{option}</span>
              <ToneSelect
                value={tone}
                onChange={next =>
                  onChange({ ...config, options: { ...config.options, [option]: next } })
                }
              />
            </div>
          ))}
        </>
      )}

      {config.type === 'colorBand' && !config.options && (
        <ThresholdEditor config={config} onChange={onChange}/>
      )}
    </div>
  );
};

const ThresholdEditor = ({
                           config,
                           onChange
                         }: {
  config: Extract<ColumnRenderConfig, { type: 'colorBand' }>;
  onChange: (config: ColumnRenderConfig) => void;
}) => {
  const bands = config.bands ?? [];
  const reversed = bands[0]?.tone === 'good';
  const order = reversed ? TONE_ORDER_REVERSED : TONE_ORDER_NORMAL;
  const low = bands[0]?.max ?? undefined;
  const high = bands[1]?.max ?? undefined;
  const update = (nextLow: number | undefined, nextHigh: number | undefined, rev: boolean) => {
    const tones = rev ? TONE_ORDER_REVERSED : TONE_ORDER_NORMAL;
    onChange({
      ...config,
      bands: [
        { max: nextLow ?? 0, tone: tones[0]! },
        { max: nextHigh ?? nextLow ?? 0, tone: tones[1]! },
        { max: null, tone: tones[2]! }
      ]
    });
  };
  return (
    <>
      <div className={styles.rendererRow}>
        <span className={styles.rendererOptionLabel}>Sort</span>
        <div className={styles.rendererInput}>
          <Select.Root
            value={reversed ? 'true' : 'false'}
            onChange={v => update(low, high, v === 'true')}
          >
            <Select.Item value={'true'}>High bad</Select.Item>
            <Select.Item value={'false'}>High good</Select.Item>
          </Select.Root>
        </div>
      </div>
      <RangeInput
        label={`${toneLabel(order[0]!)} up to`}
        value={low}
        onChange={v => update(v, high, reversed)}
      />
      <RangeInput
        label={`${toneLabel(order[1]!)} up to`}
        value={high}
        onChange={v => update(low, v, reversed)}
      />
    </>
  );
};
