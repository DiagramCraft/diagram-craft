import { type ConfigFormProps } from '../../shared/types';
import { useState } from 'react';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDown, TbArrowUp, TbGripVertical, TbPlus, TbTrash } from 'react-icons/tb';
import { NestedTabContentsEditor } from '../../shared/dashboard/nestedWidgets';
import { moveItem, resolveActiveTabId, createTab, type TabsWidgetConfig } from './tabsLogic';
import formStyles from '../../../sections/dashboard/WidgetConfigDialog.module.css';
import configFormStyles from './TabsConfigForm.module.css';

type FormProps = ConfigFormProps<TabsWidgetConfig>;

/** Tab list in a sidebar; the selected tab's contents are edited in a grid on the right. */
export const TabsConfigForm = ({ config, onChange, context }: FormProps) => {
  const { workspaceSlug } = useWorkspaceContext();
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
            workspaceSlug={workspaceSlug}
            surface={context.surface}
          />
        )}
      </div>
    </div>
  );
};
