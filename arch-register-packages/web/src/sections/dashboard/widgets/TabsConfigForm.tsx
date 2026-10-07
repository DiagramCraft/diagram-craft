import { useCallback, useRef, useState, type ComponentProps } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDown, TbArrowUp, TbPlus, TbTrash } from 'react-icons/tb';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { getNestedWidgetSpec, getNestedWidgetSpecs } from './nestedWidgets';
import { createTab, flowLayout, moveItem, TABS_TYPE, type TabsWidgetConfig } from './tabsLogic';
import styles from '../WidgetConfigDialog.module.css';

type FormProps = ComponentProps<NonNullable<DashboardWidgetSpec<TabsWidgetConfig>['configForm']>>;

const createChildWidget = (type: string): DashboardWidget => {
  const spec = getNestedWidgetSpec(type)!;
  return {
    id: `widget-${crypto.randomUUID()}`,
    x: 0,
    y: 0,
    w: Math.min(spec.defaultW, 12),
    h: spec.defaultH,
    type,
    config: spec.createDefaultConfig({})
  };
};

const numberOrUndefined = (value: string): number | undefined => {
  const parsed = Number(value);
  return value === '' || !Number.isFinite(parsed) ? undefined : parsed;
};

type NestedFormProps = {
  Form: NonNullable<DashboardWidgetSpec['configForm']>;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  context: FormProps['context'];
};

/**
 * Gives the child form a stable `onChange`. Some forms (e.g. the entity browser) sync their local
 * state upward in an effect keyed on `onChange`; an inline callback would re-fire it every render.
 */
const NestedConfigForm = ({ Form, config, onChange, context }: NestedFormProps) => {
  const latest = useRef(onChange);
  latest.current = onChange;
  const stableOnChange = useCallback((next: Record<string, unknown>) => latest.current(next), []);
  return <Form config={config} onChange={stableOnChange} context={context} />;
};

export const TabsConfigForm = ({ config, onChange, context }: FormProps) => {
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);

  const addableTypes = getNestedWidgetSpecs().filter(
    ({ type, spec }) =>
      type !== TABS_TYPE &&
      // These need a picker step (saved view / wiki page) that only the top-level dialog has
      type !== 'EntityViewEmbed' &&
      type !== 'wiki-page' &&
      spec.surfaces.includes(context.surface)
  );

  const updateTab = (index: number, patch: Partial<TabsWidgetConfig['tabs'][number]>) =>
    onChange({
      tabs: config.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab))
    });

  const updateWidgets = (tabIndex: number, widgets: DashboardWidget[]) =>
    updateTab(tabIndex, { widgets: flowLayout(widgets) });

  return (
    <>
      {config.tabs.map((tab, tabIndex) => (
        <DialogSection key={tab.id} label={`Tab ${tabIndex + 1}`} required>
          <div className={styles.options}>
            <div className={styles.optionRow}>
              <input
                type="text"
                className={styles.labelInput}
                value={tab.label}
                aria-label="Tab label"
                onChange={event => updateTab(tabIndex, { label: event.currentTarget.value })}
              />
              <Button
                variant="secondary"
                icon={<TbArrowUp size={12} />}
                onClick={() => onChange({ tabs: moveItem(config.tabs, tabIndex, -1) })}
              />
              <Button
                variant="secondary"
                icon={<TbArrowDown size={12} />}
                onClick={() => onChange({ tabs: moveItem(config.tabs, tabIndex, 1) })}
              />
              <Button
                variant="secondary"
                icon={<TbTrash size={12} />}
                disabled={config.tabs.length === 1}
                onClick={() => onChange({ tabs: config.tabs.filter((_, i) => i !== tabIndex) })}
              />
            </div>

            {tab.widgets.map(widget => {
              const spec = getNestedWidgetSpec(widget.type);
              const ChildForm = spec?.configForm;
              const isEditing = editingWidgetId === widget.id;
              const setWidget = (next: DashboardWidget) =>
                updateWidgets(
                  tabIndex,
                  tab.widgets.map(w => (w.id === widget.id ? next : w))
                );
              return (
                <div key={widget.id} className={styles.options}>
                  <div className={styles.optionRow}>
                    <span className={styles.optionLabel}>{spec?.label ?? widget.type}</span>
                    <label className={styles.checkboxRow}>
                      <span className={styles.optionLabel}>Cols</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        className={styles.labelInput}
                        value={widget.w}
                        onChange={event =>
                          setWidget({
                            ...widget,
                            w: numberOrUndefined(event.currentTarget.value) ?? widget.w
                          })
                        }
                      />
                    </label>
                    <label className={styles.checkboxRow}>
                      <span className={styles.optionLabel}>Rows</span>
                      <input
                        type="number"
                        min={1}
                        className={styles.labelInput}
                        value={widget.h}
                        onChange={event =>
                          setWidget({
                            ...widget,
                            h: numberOrUndefined(event.currentTarget.value) ?? widget.h
                          })
                        }
                      />
                    </label>
                    {ChildForm && (
                      <Button
                        variant="secondary"
                        onClick={() => setEditingWidgetId(isEditing ? null : widget.id)}
                      >
                        {isEditing ? 'Done' : 'Configure'}
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      icon={<TbArrowUp size={12} />}
                      onClick={() =>
                        updateWidgets(
                          tabIndex,
                          moveItem(tab.widgets, tab.widgets.indexOf(widget), -1)
                        )
                      }
                    />
                    <Button
                      variant="secondary"
                      icon={<TbTrash size={12} />}
                      onClick={() =>
                        updateWidgets(
                          tabIndex,
                          tab.widgets.filter(w => w.id !== widget.id)
                        )
                      }
                    />
                  </div>
                  {isEditing && ChildForm && (
                    <NestedConfigForm
                      Form={ChildForm}
                      config={widget.config}
                      onChange={next => setWidget({ ...widget, config: next })}
                      context={context}
                    />
                  )}
                </div>
              );
            })}

            <select
              className={styles.labelInput}
              value=""
              aria-label="Add widget to tab"
              onChange={event => {
                const type = event.currentTarget.value;
                if (!type) return;
                const created = createChildWidget(type);
                updateWidgets(tabIndex, [...tab.widgets, created]);
                setEditingWidgetId(created.id);
              }}
            >
              <option value="">Add widget…</option>
              {addableTypes.map(({ type, spec }) => (
                <option key={type} value={type}>
                  {spec.label}
                </option>
              ))}
            </select>
          </div>
        </DialogSection>
      ))}
      <Button
        variant="secondary"
        icon={<TbPlus size={12} />}
        onClick={() => onChange({ tabs: [...config.tabs, createTab(config.tabs)] })}
      >
        Add tab
      </Button>
    </>
  );
};
