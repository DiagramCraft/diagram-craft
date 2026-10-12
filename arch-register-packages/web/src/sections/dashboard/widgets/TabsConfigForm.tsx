import { useState, type ComponentProps } from 'react';
import { Button } from '@diagram-craft/app-components/Button';
import { TbArrowDown, TbArrowUp, TbPlus, TbTrash } from 'react-icons/tb';
import type { DashboardWidgetSpec } from '../../markdown/mdx-components/types';
import { DialogSection } from '../../markdown/editor/BlockDialog';
import { NestedTabContentsEditor } from './nestedWidgets';
import { createTab, moveItem, type TabsWidgetConfig } from './tabsLogic';
import styles from '../WidgetConfigDialog.module.css';

type FormProps = ComponentProps<NonNullable<DashboardWidgetSpec<TabsWidgetConfig>['configForm']>>;

export const TabsConfigForm = ({ config, onChange, context }: FormProps) => {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const editingTab = config.tabs.find(tab => tab.id === editingTabId);

  const updateTab = (index: number, patch: Partial<TabsWidgetConfig['tabs'][number]>) =>
    onChange({
      tabs: config.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab))
    });

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

            <div className={styles.optionRow}>
              <span className={styles.optionLabel}>
                {tab.widgets.length === 1 ? '1 widget' : `${tab.widgets.length} widgets`}
              </span>
              <Button variant="secondary" onClick={() => setEditingTabId(tab.id)}>
                Edit contents
              </Button>
            </div>
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
      {editingTab && (
        <NestedTabContentsEditor
          title={`Edit contents – ${editingTab.label}`}
          widgets={editingTab.widgets}
          workspaceSlug={context.workspaceSlug}
          surface={context.surface}
          onClose={() => setEditingTabId(null)}
          onSave={widgets => {
            updateTab(
              config.tabs.findIndex(tab => tab.id === editingTab.id),
              { widgets }
            );
            setEditingTabId(null);
          }}
        />
      )}
    </>
  );
};
