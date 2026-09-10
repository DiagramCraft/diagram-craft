import { type ReactNode, useMemo, useState } from 'react';
import {
  TbArrowDown,
  TbArrowUp,
  TbChevronDown,
  TbChevronRight,
  TbPlus,
  TbTrash
} from 'react-icons/tb';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  ColourBand,
  FieldView,
  NumberFormat,
  OverviewWidget,
  StrategyModelViewConfig,
  TableDisplay
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  isNumericFieldType,
  listOps,
  materializeFieldViews,
  numericFieldChoices,
  selectFieldChoices,
  type FieldChoice
} from './strategyViewConfigState';
import styles from './StrategyModelViewConfigEditor.module.css';

type Props = {
  schema: EntitySchema | undefined;
  value: StrategyModelViewConfig;
  onChange: (next: StrategyModelViewConfig) => void;
  disabled?: boolean;
  /** Advisory messages for view fields that no longer resolve (server `stale_view_field`). */
  diagnostics?: string[];
};

const FORMAT_OPTIONS: { value: string; label: string }[] = [
  { value: 'number', label: 'Whole number' },
  { value: 'decimal1', label: '1 decimal' },
  { value: 'currency', label: 'Currency' },
  { value: 'percent', label: 'Percent' }
];

const fieldName = (schema: EntitySchema | undefined, fieldId: string): string =>
  schema?.fields.find(field => field.id === fieldId)?.name ?? fieldId;

const Labeled = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    {children}
  </div>
);

const Toggle = ({
  checked,
  disabled,
  label,
  onChange,
  children
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  children?: ReactNode;
}) => (
  <div className={styles.toggleRow}>
    <label className={styles.toggle}>
      <Checkbox value={checked} disabled={disabled} onChange={next => onChange(!!next)} />
      {label}
    </label>
    {checked && <div className={styles.toggleBody}>{children}</div>}
  </div>
);

/**
 * The "Views" tab: how each Business Capability field is presented across the strategy app —
 * table column, subtree roll-up, detail-drawer row, and capability-map overlay — in one shared
 * display order.
 */
export const StrategyFieldsEditor = ({
  schema,
  value,
  onChange,
  disabled,
  diagnostics = []
}: Props) => (
  <div className={styles.editor}>
    <div className={styles.sub}>
      Choose which Business Capability fields the strategy surfaces show and how they aggregate and
      colour them. Fields come from the bound capability schema; the list order is the shared
      display order.
    </div>
    {diagnostics.length > 0 && (
      <div className={styles.diagnostics}>
        {diagnostics.map(message => (
          <span key={message}>{message}</span>
        ))}
      </div>
    )}
    <FieldsPanel schema={schema} value={value} disabled={disabled} onChange={onChange} />
  </div>
);

/** The "Dashboard" tab: the strategy-app Overview screen's summary tiles. */
export const StrategyDashboardEditor = ({ schema, value, onChange, disabled }: Props) => {
  const numFields = useMemo(() => numericFieldChoices(schema), [schema]);
  const selFields = useMemo(() => selectFieldChoices(schema), [schema]);
  return (
    <div className={styles.editor}>
      <div className={styles.sub}>Tiles shown on the strategy app&apos;s Overview screen.</div>
      <OverviewPanel
        value={value}
        disabled={disabled}
        numFields={numFields}
        selFields={selFields}
        onChange={onChange}
      />
    </div>
  );
};

// ── Fields ──────────────────────────────────────────────────────────────────

const FieldsPanel = ({
  schema,
  value,
  disabled,
  onChange
}: {
  schema: EntitySchema | undefined;
  value: StrategyModelViewConfig;
  disabled?: boolean;
  onChange: (next: StrategyModelViewConfig) => void;
}) => {
  const fields = useMemo(() => materializeFieldViews(value, schema), [value, schema]);
  const write = (next: FieldView[]) => onChange({ ...value, fields: next });
  const update = (index: number, patch: Partial<FieldView>) =>
    write(listOps.update(fields, index, patch));

  if (fields.length === 0) {
    return <div className={styles.empty}>The bound capability schema has no fields.</div>;
  }

  return (
    <div className={styles.cardList}>
      {fields.map((field, index) => (
        <FieldCard
          key={field.fieldId}
          field={field}
          name={fieldName(schema, field.fieldId)}
          numeric={isNumericFieldType(schema, field.fieldId)}
          disabled={disabled}
          index={index}
          count={fields.length}
          onMove={(from, to) => write(listOps.move(fields, from, to))}
          onChange={patch => update(index, patch)}
        />
      ))}
    </div>
  );
};

const DISPLAY_OPTIONS: { value: TableDisplay; label: string; numericOnly?: boolean }[] = [
  { value: 'plain', label: 'Value' },
  { value: 'bar', label: 'Bar', numericOnly: true },
  { value: 'delta', label: 'Signed delta', numericOnly: true }
];

const FieldCard = ({
  field,
  name,
  numeric,
  disabled,
  index,
  count,
  onMove,
  onChange
}: {
  field: FieldView;
  name: string;
  numeric: boolean;
  disabled?: boolean;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onChange: (patch: Partial<FieldView>) => void;
}) => {
  const markers = [
    field.table && { label: 'table', color: 'var(--blue-9)' },
    field.rollup && { label: 'roll-up', color: 'var(--green-9)' },
    field.drawer && { label: 'drawer', color: 'var(--orange-9)' },
    field.overlay && { label: 'overlay', color: 'var(--crimson-9)' }
  ].filter((marker): marker is { label: string; color: string } => Boolean(marker));

  const [expanded, setExpanded] = useState(false);

  const tableCell = field.table ?? { display: 'plain' as const };
  const rollupCell = field.rollup ?? { aggregation: 'avg' as const, format: 'decimal1' as const };
  const overlayCell = field.overlay ?? {
    direction: 'higherBetter' as const,
    format: 'decimal1' as const,
    bands: []
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <button
          type="button"
          className={styles.cardToggle}
          aria-expanded={expanded}
          onClick={() => setExpanded(prev => !prev)}
        >
          <span className={styles.cardChevron}>
            {expanded ? <TbChevronDown size={13} /> : <TbChevronRight size={13} />}
          </span>
          <span className={styles.cardTitle}>{name}</span>
        </button>
        <div className={styles.markers}>
          {markers.map(marker => (
            <span className={styles.marker} key={marker.label}>
              <span className={styles.markerDot} style={{ background: marker.color }} />
              {marker.label}
            </span>
          ))}
        </div>
        <div className={styles.cardActions}>
          <Button
            variant="ghost"
            size="xs"
            icon={<TbArrowUp size={13} />}
            disabled={disabled || index === 0}
            onClick={() => onMove(index, index - 1)}
          />
          <Button
            variant="ghost"
            size="xs"
            icon={<TbArrowDown size={13} />}
            disabled={disabled || index === count - 1}
            onClick={() => onMove(index, index + 1)}
          />
        </div>
      </div>

      {expanded && (
        <>
          <Toggle
            label="Show in Capabilities table"
            checked={field.table != null}
            disabled={disabled}
            onChange={on => onChange({ table: on ? { display: 'plain' } : null })}
          >
            <Labeled label="Header (optional)">
              <TextInput
                value={field.table?.header ?? ''}
                disabled={disabled}
                style={{ width: '10rem' }}
                placeholder={name}
                onChange={header =>
                  onChange({ table: { ...tableCell, header: header || undefined } })
                }
              />
            </Labeled>
            <Labeled label="Display">
              <Select.Root
                value={field.table?.display ?? 'plain'}
                disabled={disabled}
                style={{ width: '9rem' }}
                onChange={next =>
                  next && onChange({ table: { ...tableCell, display: next as TableDisplay } })
                }
              >
                {DISPLAY_OPTIONS.filter(option => numeric || !option.numericOnly).map(option => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </Labeled>
          </Toggle>

          <Toggle
            label={
              numeric ? 'Include in subtree roll-up' : 'Include in subtree roll-up (numeric only)'
            }
            checked={field.rollup != null}
            disabled={disabled || !numeric}
            onChange={on =>
              onChange({ rollup: on ? { aggregation: 'avg', format: 'decimal1' } : null })
            }
          >
            <Labeled label="Aggregation">
              <Select.Root
                value={field.rollup?.aggregation ?? 'avg'}
                disabled={disabled}
                style={{ width: '8rem' }}
                onChange={next =>
                  next &&
                  onChange({
                    rollup: { ...rollupCell, aggregation: next as 'avg' | 'sum' }
                  })
                }
              >
                <Select.Item value="avg">Average</Select.Item>
                <Select.Item value="sum">Sum</Select.Item>
              </Select.Root>
            </Labeled>
            <Labeled label="Format">
              <Select.Root
                value={field.rollup?.format ?? 'decimal1'}
                disabled={disabled}
                style={{ width: '9rem' }}
                onChange={next =>
                  next &&
                  onChange({
                    rollup: {
                      aggregation: rollupCell.aggregation,
                      format: next as NumberFormat
                    }
                  })
                }
              >
                {FORMAT_OPTIONS.map(option => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </Labeled>
          </Toggle>

          <Toggle
            label="Show as a row in the detail drawer"
            checked={field.drawer}
            disabled={disabled}
            onChange={on => onChange({ drawer: on })}
          />

          <Toggle
            label={
              numeric ? 'Show as a capability-map overlay' : 'Show as an overlay (numeric only)'
            }
            checked={field.overlay != null}
            disabled={disabled || !numeric}
            onChange={on =>
              onChange({
                overlay: on ? { direction: 'higherBetter', format: 'decimal1', bands: [] } : null
              })
            }
          >
            <Labeled label="Direction">
              <Select.Root
                value={field.overlay?.direction ?? 'higherBetter'}
                disabled={disabled}
                style={{ width: '10rem' }}
                onChange={next =>
                  next &&
                  onChange({
                    overlay: { ...overlayCell, direction: next as 'higherBetter' | 'lowerBetter' }
                  })
                }
              >
                <Select.Item value="higherBetter">Higher is better</Select.Item>
                <Select.Item value="lowerBetter">Lower is better</Select.Item>
              </Select.Root>
            </Labeled>
            <BandsEditor
              bands={field.overlay?.bands ?? []}
              disabled={disabled}
              onChange={bands => onChange({ overlay: { ...overlayCell, bands } })}
            />
          </Toggle>
        </>
      )}
    </div>
  );
};

const BandsEditor = ({
  bands,
  disabled,
  onChange
}: {
  bands: ColourBand[];
  disabled?: boolean;
  onChange: (bands: ColourBand[]) => void;
}) => (
  <div className={styles.bands}>
    <span className={styles.fieldLabel}>Colour bands (low to high; leave the last max empty)</span>
    {bands.map((band, index) => (
      <div className={styles.bandRow} key={index}>
        <span className={styles.sub}>≤</span>
        <NumberInput
          value={band.max ?? ''}
          disabled={disabled}
          style={{ width: '6rem' }}
          onChange={max =>
            onChange(listOps.update(bands, index, { max: max === undefined ? null : max }))
          }
        />
        <Select.Root
          value={band.tone}
          disabled={disabled}
          style={{ width: '9rem' }}
          onChange={next =>
            next && onChange(listOps.update(bands, index, { tone: next as ColourBand['tone'] }))
          }
        >
          <Select.Item value="good">Good (green)</Select.Item>
          <Select.Item value="warn">Warn (amber)</Select.Item>
          <Select.Item value="bad">Bad (red)</Select.Item>
        </Select.Root>
        <Button
          variant="ghost"
          size="xs"
          icon={<TbTrash size={12} />}
          disabled={disabled}
          onClick={() => onChange(listOps.remove(bands, index))}
        />
      </div>
    ))}
    <div>
      <Button
        variant="ghost"
        size="xs"
        icon={<TbPlus size={12} />}
        disabled={disabled}
        onClick={() => onChange(listOps.add(bands, { max: null, tone: 'warn' }))}
      >
        Add band
      </Button>
    </div>
  </div>
);

// ── Overview ────────────────────────────────────────────────────────────────

const WIDGET_KINDS: {
  value: OverviewWidget['kind'];
  label: string;
  needsField?: 'select' | 'numeric';
}[] = [
  { value: 'countByLevel', label: 'Capabilities by level' },
  { value: 'countBySelect', label: 'Count by select field', needsField: 'select' },
  { value: 'coveragePercent', label: 'Application coverage %' },
  { value: 'orphanCount', label: 'Orphan capability count' },
  { value: 'topGap', label: 'Largest values (field)', needsField: 'numeric' }
];

const OverviewPanel = ({
  value,
  disabled,
  numFields,
  selFields,
  onChange
}: {
  value: StrategyModelViewConfig;
  disabled?: boolean;
  numFields: FieldChoice[];
  selFields: FieldChoice[];
  onChange: (next: StrategyModelViewConfig) => void;
}) => {
  const widgets = value.overviewWidgets;
  const write = (next: OverviewWidget[]) => onChange({ ...value, overviewWidgets: next });
  const replace = (index: number, widget: OverviewWidget) =>
    write(widgets.map((w, i) => (i === index ? widget : w)));

  return (
    <div className={styles.cardList}>
      {widgets.map((widget, index) => {
        const kind = WIDGET_KINDS.find(k => k.value === widget.kind);
        const fieldChoices = kind?.needsField === 'numeric' ? numFields : selFields;
        return (
          <div className={styles.card} key={`${widget.kind}-${index}`}>
            <div className={styles.cardHead}>
              <span className={styles.cardTitle}>{widget.title || 'Tile'}</span>
              <div className={styles.cardActions}>
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<TbArrowUp size={13} />}
                  disabled={disabled || index === 0}
                  onClick={() => write(listOps.move(widgets, index, index - 1))}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<TbArrowDown size={13} />}
                  disabled={disabled || index === widgets.length - 1}
                  onClick={() => write(listOps.move(widgets, index, index + 1))}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  icon={<TbTrash size={13} />}
                  disabled={disabled}
                  onClick={() => write(listOps.remove(widgets, index))}
                />
              </div>
            </div>
            <div className={styles.cardBody}>
              <Labeled label="Title">
                <TextInput
                  value={widget.title}
                  disabled={disabled}
                  style={{ width: '11rem' }}
                  placeholder="Tile title"
                  onChange={title => replace(index, { ...widget, title: title ?? '' })}
                />
              </Labeled>
              <Labeled label="Tile type">
                <Select.Root
                  value={widget.kind}
                  disabled={disabled}
                  style={{ width: '13rem' }}
                  onChange={next => {
                    if (!next) return;
                    const nextKind = WIDGET_KINDS.find(k => k.value === next);
                    if (!nextKind) return;
                    if (nextKind.needsField === 'select')
                      replace(index, {
                        kind: 'countBySelect',
                        title: widget.title,
                        fieldId: selFields[0]?.id ?? ''
                      });
                    else if (nextKind.needsField === 'numeric')
                      replace(index, {
                        kind: 'topGap',
                        title: widget.title,
                        fieldId: numFields[0]?.id ?? '',
                        limit: 5
                      });
                    else
                      replace(index, {
                        kind: next as 'countByLevel' | 'coveragePercent' | 'orphanCount',
                        title: widget.title
                      });
                  }}
                >
                  {WIDGET_KINDS.map(k => (
                    <Select.Item key={k.value} value={k.value}>
                      {k.label}
                    </Select.Item>
                  ))}
                </Select.Root>
              </Labeled>
              {(widget.kind === 'countBySelect' || widget.kind === 'topGap') && (
                <Labeled label="Field">
                  <Select.Root
                    value={widget.fieldId}
                    disabled={disabled}
                    style={{ width: '13rem' }}
                    onChange={fieldId => fieldId && replace(index, { ...widget, fieldId })}
                  >
                    {!fieldChoices.some(choice => choice.id === widget.fieldId) &&
                      widget.fieldId.length > 0 && (
                        <Select.Item value={widget.fieldId}>
                          Missing field · {widget.fieldId}
                        </Select.Item>
                      )}
                    {fieldChoices.map(choice => (
                      <Select.Item key={choice.id} value={choice.id}>
                        {choice.label} · {choice.id}
                      </Select.Item>
                    ))}
                  </Select.Root>
                </Labeled>
              )}
              {widget.kind === 'topGap' && (
                <Labeled label="How many">
                  <NumberInput
                    value={widget.limit}
                    disabled={disabled}
                    style={{ width: '4.5rem' }}
                    onChange={limit =>
                      limit !== undefined &&
                      replace(index, { ...widget, limit: Math.max(1, Math.min(20, limit)) })
                    }
                  />
                </Labeled>
              )}
            </div>
          </div>
        );
      })}
      <div className={styles.addRow}>
        <Button
          variant="ghost"
          size="xs"
          icon={<TbPlus size={13} />}
          disabled={disabled}
          onClick={() => write(listOps.add(widgets, { kind: 'countByLevel', title: 'By level' }))}
        >
          Add tile
        </Button>
      </div>
    </div>
  );
};
