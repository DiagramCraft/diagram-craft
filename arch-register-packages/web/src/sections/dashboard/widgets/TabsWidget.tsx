import { useNavigate, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { NestedWidgetRenderer } from './nestedWidgets';
import styles from './TabsWidget.module.css';
import { TbLayoutList } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { getNestedWidgetSpec } from './nestedWidgets';
import { useState, type ComponentProps } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDown, TbArrowUp, TbGripVertical, TbPlus, TbTrash } from 'react-icons/tb';
import { NestedTabContentsEditor } from './nestedWidgets';
import { moveItem, resolveActiveTabId } from './tabsLogic';
import formStyles from '../WidgetConfigDialog.module.css';
import configFormStyles from './TabsConfigForm.module.css';
import { createTab, isValidTabsConfig, type TabsWidgetConfig } from './tabsLogic';

/** Search param that keeps the active tab across reloads and in shared links. */
export const TABS_SEARCH_PARAM = 'tab';

export const TabsWidget = ({ config }: { config: TabsWidgetConfig }) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const [localTab, setLocalTab] = useState<string | undefined>();

  const active = resolveActiveTabId(config.tabs, search[TABS_SEARCH_PARAM] ?? localTab);

  const handleChange = (value: string) => {
    setLocalTab(value);
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({ ...prev, [TABS_SEARCH_PARAM]: value }),
      replace: true
    } as never);
  };

  return (
    <Tabs.Root value={active} onValueChange={handleChange}>
      <Tabs.List>
        {config.tabs.map(tab => (
          <Tabs.Trigger key={tab.id} value={tab.id}>
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {config.tabs.map(tab => (
        <Tabs.Content key={tab.id} value={tab.id}>
          <div className={styles.root}>
            {tab.widgets.length === 0 ? (
              <div className={styles.empty}>This tab has no widgets.</div>
            ) : (
              <div className={styles.grid}>
                {tab.widgets.map(widget => (
                  <div
                    key={widget.id}
                    style={{
                      gridColumn: `${widget.x + 1} / span ${widget.w}`,
                      gridRow: `${widget.y + 1} / span ${widget.h}`,
                      minWidth: 0
                    }}
                  >
                    <NestedWidgetRenderer widget={widget} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
};

type FormProps = ComponentProps<NonNullable<DashboardWidgetSpec<TabsWidgetConfig>['configForm']>>;

/** Tab list in a sidebar; the selected tab's contents are edited in a grid on the right. */
export const TabsConfigForm = ({ config, onChange, context }: FormProps) => {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const activeId = resolveActiveTabId(config.tabs, selectedId);
  const activeIndex = config.tabs.findIndex(tab => tab.id === activeId);
  const activeTab = config.tabs[activeIndex];
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const moveTab = (from: number, to: number) => {
    if (from === to) return;
    const tabs = [...config.tabs];
    tabs.splice(to, 0, tabs.splice(from, 1)[0]!);
    onChange({ tabs });
  };

  const updateTab = (index: number, patch: Partial<TabsWidgetConfig['tabs'][number]>) =>
    onChange({
      tabs: config.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab))
    });

  return (
    <div className={configFormStyles.layout}>
      <div className={configFormStyles.sidebar}>
        {config.tabs.map((tab, tabIndex) => (
          <div
            key={tab.id}
            className={configFormStyles.tabItem}
            data-selected={tab.id === activeId}
            onClick={() => setSelectedId(tab.id)}
            draggable={dragIndex === tabIndex}
            onDragOver={event => dragIndex !== null && event.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) moveTab(dragIndex, tabIndex);
              setDragIndex(null);
            }}
            onDragEnd={() => setDragIndex(null)}
          >
            <span
              className={configFormStyles.handle}
              title="Select or drag to reorder"
              onMouseDown={() => setDragIndex(tabIndex)}
              onMouseUp={() => setDragIndex(null)}
            >
              <TbGripVertical size={14} />
            </span>
            <input
              type="text"
              className={formStyles.labelInput}
              value={tab.label}
              aria-label="Tab label"
              onFocus={() => setSelectedId(tab.id)}
              onChange={event => updateTab(tabIndex, { label: event.currentTarget.value })}
            />
            <div className={configFormStyles.tabActions}>
              <Button
                variant="icon-only"
                size="sm"
                icon={<TbArrowUp size={12} />}
                disabled={tabIndex === 0}
                onClick={() => onChange({ tabs: moveItem(config.tabs, tabIndex, -1) })}
              />
              <Button
                variant="icon-only"
                size="sm"
                icon={<TbArrowDown size={12} />}
                disabled={tabIndex === config.tabs.length - 1}
                onClick={() => onChange({ tabs: moveItem(config.tabs, tabIndex, 1) })}
              />
              <Button
                variant="icon-only"
                size="sm"
                icon={<TbTrash size={12} />}
                disabled={config.tabs.length === 1}
                onClick={() => onChange({ tabs: config.tabs.filter((_, i) => i !== tabIndex) })}
              />
            </div>
          </div>
        ))}
        <Button
          variant="secondary"
          icon={<TbPlus size={12} />}
          onClick={() => {
            const tab = createTab(config.tabs);
            onChange({ tabs: [...config.tabs, tab] });
            setSelectedId(tab.id);
          }}
        >
          Add tab
        </Button>
      </div>

      <div className={configFormStyles.content}>
        {activeTab && (
          <NestedTabContentsEditor
            key={activeTab.id}
            widgets={activeTab.widgets}
            onChange={widgets => updateTab(activeIndex, { widgets })}
            workspaceSlug={context.workspaceSlug}
            surface={context.surface}
          />
        )}
      </div>
    </div>
  );
};

export const _tabsSpecData: Omit<DashboardWidgetSpec<TabsWidgetConfig>, 'label' | 'description'> = {
  icon: TbLayoutList,
  defaultW: 12,
  defaultH: 24,
  surfaces: ['workspace', 'project'],
  component: TabsWidget,
  frame: { hideOutsideEdit: true, padded: false, showIcon: false },
  isValidConfig: (config): config is TabsWidgetConfig =>
    isValidTabsConfig(config, child => {
      const spec = getNestedWidgetSpec(child.type);
      return !!spec && spec.isValidConfig(child.config);
    }),
  createDefaultConfig: () => ({ tabs: [createTab([], 'Tab')] }),
  configForm: TabsConfigForm,
  dialogSize: 'large'
};
