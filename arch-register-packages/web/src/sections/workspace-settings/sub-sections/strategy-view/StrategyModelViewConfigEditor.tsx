import { type ReactNode, useMemo, useState } from 'react';
import { TbArrowDown, TbArrowUp, TbPlus, TbTrash } from 'react-icons/tb';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  Overlay,
  OverviewWidget,
  RollupField,
  StrategyModelViewConfig
} from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import { Button } from '@diagram-craft/app-components/Button';
import { Checkbox } from '@diagram-craft/app-components/Checkbox';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import {
  listOps,
  numericFieldChoices,
  schemaFieldChoices,
  selectFieldChoices,
  TABLE_PSEUDO_CHOICES,
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

const Labeled = ({
  label,
  children
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className={styles.field}>
    <span className={styles.fieldLabel}>{label}</span>
    {children}
  </div>
);

const Card = ({
  title,
  index,
  count,
  disabled,
  onMove,
  onRemove,
  children
}: {
  title: string;
  index: number;
  count: number;
  disabled?: boolean;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
  children: ReactNode;
}) => (
  <div className={styles.card}>
    <div className={styles.cardHead}>
      <span className={styles.cardTitle}>{title || 'Untitled'}</span>
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
        <Button
          variant="ghost"
          size="xs"
          icon={<TbTrash size={13} />}
          disabled={disabled}
          onClick={() => onRemove(index)}
        />
      </div>
    </div>
    <div className={styles.cardBody}>{children}</div>
  </div>
);

const FieldSelect = ({
  value,
  choices,
  disabled,
  placeholder = 'Select a field…',
  width = '14rem',
  onChange
}: {
  value: string;
  choices: FieldChoice[];
  disabled?: boolean;
  placeholder?: string;
  width?: string;
  onChange: (value: string) => void;
}) => (
  <Select.Root
    value={value}
    disabled={disabled}
    placeholder={placeholder}
    style={{ width }}
    onChange={next => next && onChange(next)}
  >
    {!choices.some(choice => choice.id === value) && value.length > 0 && (
      <Select.Item value={value}>Missing field · {value}</Select.Item>
    )}
    {choices.map(choice => (
      <Select.Item key={choice.id} value={choice.id}>
        {choice.label} · {choice.id}
      </Select.Item>
    ))}
  </Select.Root>
);

const AddButton = ({
  label,
  disabled,
  onClick
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) => (
  <div className={styles.addRow}>
    <Button
      variant="ghost"
      size="xs"
      icon={<TbPlus size={13} />}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </Button>
  </div>
);

export const StrategyModelViewConfigEditor = ({
  schema,
  value,
  onChange,
  disabled,
  diagnostics = []
}: Props) => {
  const [tab, setTab] = useState('table');

  const allFields = useMemo(() => schemaFieldChoices(schema), [schema]);
  const numFields = useMemo(() => numericFieldChoices(schema), [schema]);
  const selFields = useMemo(() => selectFieldChoices(schema), [schema]);
  const tableChoices = useMemo(() => [...TABLE_PSEUDO_CHOICES, ...allFields], [allFields]);
  const labelFor = (fieldId: string) =>
    allFields.find(choice => choice.id === fieldId)?.label ??
    TABLE_PSEUDO_CHOICES.find(choice => choice.id === fieldId)?.label ??
    fieldId;

  const patch = (part: Partial<StrategyModelViewConfig>) => onChange({ ...value, ...part });

  return (
    <div className={styles.editor}>
      <div className={styles.head}>
        <div className={styles.title}>Capability views</div>
        <div className={styles.sub}>
          Choose which Business Capability fields each Strategy &amp; Capability Modelling surface
          shows and how it aggregates them. Fields come from the bound capability schema; retire a
          field in the schema editor and it drops out of every view here.
        </div>
      </div>

      {diagnostics.length > 0 && (
        <div className={styles.diagnostics}>
          {diagnostics.map(message => (
            <span key={message}>{message}</span>
          ))}
        </div>
      )}

      <Tabs.Root value={tab} onValueChange={setTab}>
        <Tabs.List aria-label="Capability view surfaces">
          <Tabs.Trigger value="table">Table</Tabs.Trigger>
          <Tabs.Trigger value="rollups">Roll-ups</Tabs.Trigger>
          <Tabs.Trigger value="overlays">Map overlays</Tabs.Trigger>
          <Tabs.Trigger value="heatmap">Heatmap</Tabs.Trigger>
          <Tabs.Trigger value="drawer">Detail drawer</Tabs.Trigger>
          <Tabs.Trigger value="overview">Overview</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="table" style={{ height: 'auto' }}>
          <TableColumnsPanel
            value={value}
            disabled={disabled}
            choices={tableChoices}
            labelFor={labelFor}
            onChange={patch}
          />
        </Tabs.Content>
        <Tabs.Content value="rollups" style={{ height: 'auto' }}>
          <RollupsPanel
            value={value}
            disabled={disabled}
            choices={numFields}
            labelFor={labelFor}
            onChange={patch}
          />
        </Tabs.Content>
        <Tabs.Content value="overlays" style={{ height: 'auto' }}>
          <OverlaysPanel
            value={value}
            disabled={disabled}
            fieldChoices={numFields}
            onChange={patch}
          />
        </Tabs.Content>
        <Tabs.Content value="heatmap" style={{ height: 'auto' }}>
          <HeatmapPanel
            value={value}
            disabled={disabled}
            numFields={numFields}
            selFields={selFields}
            onChange={patch}
          />
        </Tabs.Content>
        <Tabs.Content value="drawer" style={{ height: 'auto' }}>
          <DrawerPanel
            value={value}
            disabled={disabled}
            choices={allFields}
            labelFor={labelFor}
            onChange={patch}
          />
        </Tabs.Content>
        <Tabs.Content value="overview" style={{ height: 'auto' }}>
          <OverviewPanel
            value={value}
            disabled={disabled}
            numFields={numFields}
            selFields={selFields}
            onChange={patch}
          />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
};

type PanelProps = {
  value: StrategyModelViewConfig;
  disabled?: boolean;
  onChange: (part: Partial<StrategyModelViewConfig>) => void;
};
type LabelFor = { labelFor: (fieldId: string) => string };

const TableColumnsPanel = ({
  value,
  disabled,
  choices,
  labelFor,
  onChange
}: PanelProps & LabelFor & { choices: FieldChoice[] }) => {
  const columns = value.tableColumns;
  return (
    <div className={styles.cardList}>
      {columns.length === 0 && (
        <div className={styles.empty}>No columns — the Capabilities table shows nothing.</div>
      )}
      {columns.map((column, index) => (
        <Card
          key={`${column.fieldId}-${index}`}
          title={column.label ?? labelFor(column.fieldId)}
          index={index}
          count={columns.length}
          disabled={disabled}
          onMove={(from, to) => onChange({ tableColumns: listOps.move(columns, from, to) })}
          onRemove={i => onChange({ tableColumns: listOps.remove(columns, i) })}
        >
          <Labeled label="Field">
            <FieldSelect
              value={column.fieldId}
              choices={choices}
              disabled={disabled}
              onChange={fieldId =>
                onChange({ tableColumns: listOps.update(columns, index, { fieldId }) })
              }
            />
          </Labeled>
          <Labeled label="Header (optional)">
            <TextInput
              value={column.label ?? ''}
              disabled={disabled}
              style={{ width: '12rem' }}
              placeholder={labelFor(column.fieldId)}
              onChange={label =>
                onChange({
                  tableColumns: listOps.update(columns, index, { label: label || undefined })
                })
              }
            />
          </Labeled>
          <Labeled label="Shown">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', height: '1.6rem' }}>
              <Checkbox
                value={column.visible}
                disabled={disabled}
                onChange={visible =>
                  onChange({ tableColumns: listOps.update(columns, index, { visible: !!visible }) })
                }
              />
              Visible
            </label>
          </Labeled>
        </Card>
      ))}
      <AddButton
        label="Add column"
        disabled={disabled || choices.length === 0}
        onClick={() =>
          onChange({
            tableColumns: listOps.add(columns, { fieldId: choices[0]?.id ?? '', visible: true })
          })
        }
      />
    </div>
  );
};

const RollupsPanel = ({
  value,
  disabled,
  choices,
  labelFor,
  onChange
}: PanelProps & LabelFor & { choices: FieldChoice[] }) => {
  const rollups = value.rollups;
  return (
    <div className={styles.cardList}>
      {rollups.map((rollup: RollupField, index) => (
        <Card
          key={`${rollup.fieldId}-${index}`}
          title={rollup.label ?? labelFor(rollup.fieldId)}
          index={index}
          count={rollups.length}
          disabled={disabled}
          onMove={(from, to) => onChange({ rollups: listOps.move(rollups, from, to) })}
          onRemove={i => onChange({ rollups: listOps.remove(rollups, i) })}
        >
          <Labeled label="Field">
            <FieldSelect
              value={rollup.fieldId}
              choices={choices}
              disabled={disabled}
              onChange={fieldId =>
                onChange({ rollups: listOps.update(rollups, index, { fieldId }) })
              }
            />
          </Labeled>
          <Labeled label="Aggregation">
            <Select.Root
              value={rollup.aggregation}
              disabled={disabled}
              style={{ width: '8rem' }}
              onChange={next =>
                next &&
                onChange({
                  rollups: listOps.update(rollups, index, {
                    aggregation: next as RollupField['aggregation']
                  })
                })
              }
            >
              <Select.Item value="avg">Average</Select.Item>
              <Select.Item value="sum">Sum</Select.Item>
            </Select.Root>
          </Labeled>
          <Labeled label="Format">
            <Select.Root
              value={rollup.format}
              disabled={disabled}
              style={{ width: '9rem' }}
              onChange={next =>
                next &&
                onChange({
                  rollups: listOps.update(rollups, index, { format: next as RollupField['format'] })
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
          <Labeled label="Label (optional)">
            <TextInput
              value={rollup.label ?? ''}
              disabled={disabled}
              style={{ width: '11rem' }}
              placeholder={labelFor(rollup.fieldId)}
              onChange={label =>
                onChange({ rollups: listOps.update(rollups, index, { label: label || undefined }) })
              }
            />
          </Labeled>
        </Card>
      ))}
      <AddButton
        label="Add roll-up"
        disabled={disabled || choices.length === 0}
        onClick={() =>
          onChange({
            rollups: listOps.add(rollups, {
              fieldId: choices[0]?.id ?? '',
              aggregation: 'avg',
              format: 'decimal1'
            })
          })
        }
      />
    </div>
  );
};

const OverlaysPanel = ({
  value,
  disabled,
  fieldChoices,
  onChange
}: PanelProps & { fieldChoices: FieldChoice[] }) => {
  const overlays = value.overlays;
  const updateOverlay = (index: number, part: Partial<Overlay>) =>
    onChange({ overlays: listOps.update(overlays, index, part) });
  return (
    <div className={styles.cardList}>
      {overlays.map((overlay, index) => (
        <Card
          key={`${overlay.id}-${index}`}
          title={overlay.label}
          index={index}
          count={overlays.length}
          disabled={disabled}
          onMove={(from, to) => onChange({ overlays: listOps.move(overlays, from, to) })}
          onRemove={i => onChange({ overlays: listOps.remove(overlays, i) })}
        >
          <Labeled label="Label">
            <TextInput
              value={overlay.label}
              disabled={disabled}
              style={{ width: '10rem' }}
              placeholder="Overlay label"
              onChange={label => updateOverlay(index, { label: label ?? '' })}
            />
          </Labeled>
          <Labeled label="Field">
            <FieldSelect
              value={overlay.fieldId}
              choices={fieldChoices}
              disabled={disabled}
              onChange={fieldId => updateOverlay(index, { fieldId })}
            />
          </Labeled>
          <Labeled label="Source">
            <Select.Root
              value={overlay.source}
              disabled={disabled}
              style={{ width: '10rem' }}
              onChange={next => next && updateOverlay(index, { source: next as Overlay['source'] })}
            >
              <Select.Item value="rollup">Subtree roll-up</Select.Item>
              <Select.Item value="field">Own value</Select.Item>
            </Select.Root>
          </Labeled>
          <Labeled label="Direction">
            <Select.Root
              value={overlay.direction}
              disabled={disabled}
              style={{ width: '10rem' }}
              onChange={next =>
                next && updateOverlay(index, { direction: next as Overlay['direction'] })
              }
            >
              <Select.Item value="higherBetter">Higher is better</Select.Item>
              <Select.Item value="lowerBetter">Lower is better</Select.Item>
            </Select.Root>
          </Labeled>
          <Labeled label="Value format">
            <Select.Root
              value={overlay.format}
              disabled={disabled}
              style={{ width: '9rem' }}
              onChange={next =>
                next && updateOverlay(index, { format: next as Overlay['format'] })
              }
            >
              {FORMAT_OPTIONS.map(option => (
                <Select.Item key={option.value} value={option.value}>
                  {option.label}
                </Select.Item>
              ))}
            </Select.Root>
          </Labeled>
          <div className={styles.bands}>
            <span className={styles.fieldLabel}>Colour bands (best to worst)</span>
            {overlay.bands.map((band, bandIndex) => (
              <div className={styles.bandRow} key={bandIndex}>
                <span className={styles.sub}>≤</span>
                <NumberInput
                  value={band.max ?? ''}
                  disabled={disabled}
                  style={{ width: '6rem' }}
                  onChange={max =>
                    updateOverlay(index, {
                      bands: listOps.update(overlay.bands, bandIndex, {
                        max: max === undefined ? null : max
                      })
                    })
                  }
                />
                <Select.Root
                  value={band.tone}
                  disabled={disabled}
                  style={{ width: '9rem' }}
                  onChange={next =>
                    next &&
                    updateOverlay(index, {
                      bands: listOps.update(overlay.bands, bandIndex, {
                        tone: next as Overlay['bands'][number]['tone']
                      })
                    })
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
                  onClick={() =>
                    updateOverlay(index, { bands: listOps.remove(overlay.bands, bandIndex) })
                  }
                />
              </div>
            ))}
            <div>
              <Button
                variant="ghost"
                size="xs"
                icon={<TbPlus size={12} />}
                disabled={disabled}
                onClick={() =>
                  updateOverlay(index, {
                    bands: listOps.add(overlay.bands, { max: null, tone: 'warn' })
                  })
                }
              >
                Add band
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <AddButton
        label="Add overlay"
        disabled={disabled || fieldChoices.length === 0}
        onClick={() =>
          onChange({
            overlays: listOps.add(overlays, {
              id: `overlay-${overlays.length + 1}`,
              label: 'New overlay',
              source: 'rollup',
              fieldId: fieldChoices[0]?.id ?? '',
              direction: 'higherBetter',
              format: 'decimal1',
              bands: []
            })
          })
        }
      />
    </div>
  );
};

const HeatmapPanel = ({
  value,
  disabled,
  numFields,
  selFields,
  onChange
}: PanelProps & { numFields: FieldChoice[]; selFields: FieldChoice[] }) => {
  const heatmap = value.heatmap;
  const axisChoices = [...numFields, ...selFields.filter(f => !numFields.some(n => n.id === f.id))];
  if (!heatmap) {
    return (
      <div className={styles.cardList}>
        <div className={styles.empty}>No default heatmap configured.</div>
        <AddButton
          label="Configure default heatmap"
          disabled={disabled || axisChoices.length < 2}
          onClick={() =>
            onChange({
              heatmap: {
                xFieldId: axisChoices[0]?.id ?? '',
                yFieldId: axisChoices[1]?.id ?? axisChoices[0]?.id ?? '',
                colorFieldId: null,
                buckets: 5
              }
            })
          }
        />
      </div>
    );
  }
  return (
    <div className={styles.cardList}>
      <div className={styles.card}>
        <div className={styles.cardBody}>
          <Labeled label="X axis">
            <FieldSelect
              value={heatmap.xFieldId}
              choices={axisChoices}
              disabled={disabled}
              onChange={xFieldId => onChange({ heatmap: { ...heatmap, xFieldId } })}
            />
          </Labeled>
          <Labeled label="Y axis">
            <FieldSelect
              value={heatmap.yFieldId}
              choices={axisChoices}
              disabled={disabled}
              onChange={yFieldId => onChange({ heatmap: { ...heatmap, yFieldId } })}
            />
          </Labeled>
          <Labeled label="Colour by">
            <Select.Root
              value={heatmap.colorFieldId ?? ''}
              disabled={disabled}
              style={{ width: '14rem' }}
              placeholder="Count of capabilities"
              onChange={next =>
                onChange({
                  heatmap: { ...heatmap, colorFieldId: next && next.length > 0 ? next : null }
                })
              }
            >
              <Select.Item value="">Count of capabilities</Select.Item>
              {numFields.map(field => (
                <Select.Item key={field.id} value={field.id}>
                  {field.label} · {field.id}
                </Select.Item>
              ))}
            </Select.Root>
          </Labeled>
          <Labeled label="Buckets per axis">
            <NumberInput
              value={heatmap.buckets}
              disabled={disabled}
              style={{ width: '5rem' }}
              onChange={buckets =>
                buckets !== undefined &&
                onChange({
                  heatmap: { ...heatmap, buckets: Math.max(2, Math.min(6, Math.round(buckets))) }
                })
              }
            />
          </Labeled>
        </div>
        <div>
          <Button
            variant="ghost"
            size="xs"
            icon={<TbTrash size={13} />}
            disabled={disabled}
            onClick={() => onChange({ heatmap: null })}
          >
            Remove default heatmap
          </Button>
        </div>
      </div>
    </div>
  );
};

const DrawerPanel = ({
  value,
  disabled,
  choices,
  labelFor,
  onChange
}: PanelProps & LabelFor & { choices: FieldChoice[] }) => {
  const ids = value.drawerFieldIds;
  return (
    <div className={styles.cardList}>
      {ids.map((fieldId, index) => (
        <Card
          key={`${fieldId}-${index}`}
          title={labelFor(fieldId)}
          index={index}
          count={ids.length}
          disabled={disabled}
          onMove={(from, to) => onChange({ drawerFieldIds: listOps.move(ids, from, to) })}
          onRemove={i => onChange({ drawerFieldIds: listOps.remove(ids, i) })}
        >
          <Labeled label="Field">
            <FieldSelect
              value={fieldId}
              choices={choices}
              disabled={disabled}
              onChange={next =>
                onChange({ drawerFieldIds: ids.map((id, i) => (i === index ? next : id)) })
              }
            />
          </Labeled>
        </Card>
      ))}
      <AddButton
        label="Add attribute"
        disabled={disabled || choices.length === 0}
        onClick={() => onChange({ drawerFieldIds: listOps.add(ids, choices[0]?.id ?? '') })}
      />
    </div>
  );
};

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
}: PanelProps & { numFields: FieldChoice[]; selFields: FieldChoice[] }) => {
  const widgets = value.overviewWidgets;
  const replaceWidget = (index: number, widget: OverviewWidget) =>
    onChange({ overviewWidgets: widgets.map((w, i) => (i === index ? widget : w)) });
  return (
    <div className={styles.cardList}>
      {widgets.map((widget, index) => {
        const kind = WIDGET_KINDS.find(k => k.value === widget.kind);
        const fieldChoices = kind?.needsField === 'numeric' ? numFields : selFields;
        return (
          <Card
            key={`${widget.kind}-${index}`}
            title={widget.title}
            index={index}
            count={widgets.length}
            disabled={disabled}
            onMove={(from, to) => onChange({ overviewWidgets: listOps.move(widgets, from, to) })}
            onRemove={i => onChange({ overviewWidgets: listOps.remove(widgets, i) })}
          >
            <Labeled label="Title">
              <TextInput
                value={widget.title}
                disabled={disabled}
                style={{ width: '11rem' }}
                placeholder="Tile title"
                onChange={title => replaceWidget(index, { ...widget, title: title ?? '' })}
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
                    replaceWidget(index, {
                      kind: 'countBySelect',
                      title: widget.title,
                      fieldId: selFields[0]?.id ?? ''
                    });
                  else if (nextKind.needsField === 'numeric')
                    replaceWidget(index, {
                      kind: 'topGap',
                      title: widget.title,
                      fieldId: numFields[0]?.id ?? '',
                      limit: 5
                    });
                  else
                    replaceWidget(index, {
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
                <FieldSelect
                  value={widget.fieldId}
                  choices={fieldChoices}
                  disabled={disabled}
                  onChange={fieldId => replaceWidget(index, { ...widget, fieldId })}
                />
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
                    replaceWidget(index, { ...widget, limit: Math.max(1, Math.min(20, limit)) })
                  }
                />
              </Labeled>
            )}
          </Card>
        );
      })}
      <AddButton
        label="Add tile"
        disabled={disabled}
        onClick={() =>
          onChange({
            overviewWidgets: listOps.add(widgets, { kind: 'countByLevel', title: 'By level' })
          })
        }
      />
    </div>
  );
};
