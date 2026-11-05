import { type ConfigFormProps } from '../../shared/types';
import { useState } from 'react';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { ListEditor } from '../../../components/ListEditor';
import { TabContentsEditor } from '../../../sections/dashboard/TabContentsEditor';
import { resolveActiveTabId, createTab, type TabsWidgetConfig } from './tabsLogic';
import configFormStyles from './TabsConfigForm.module.css';

type FormProps = ConfigFormProps<TabsWidgetConfig>;

/** Tab list in a sidebar; the selected tab's contents are edited in a grid on the right. */
export const TabsConfigForm = ({ config, onChange, context }: FormProps) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const activeId = resolveActiveTabId(config.tabs, selectedId);
  const activeIndex = config.tabs.findIndex(tab => tab.id === activeId);
  const activeTab = config.tabs[activeIndex];

  const updateTab = (index: number, patch: Partial<TabsWidgetConfig['tabs'][number]>) =>
    onChange({
      tabs: config.tabs.map((tab, i) => (i === index ? { ...tab, ...patch } : tab))
    });

  return (
    <div className={configFormStyles.layout}>
      <div className={configFormStyles.sidebar}>
        <ListEditor
          items={config.tabs}
          onChange={tabs => onChange({ tabs })}
          getId={tab => tab.id}
          createItem={() => {
            const tab = createTab(config.tabs);
            setSelectedId(tab.id);
            return tab;
          }}
          addLabel="Add tab"
          reorder="drag+buttons"
          canRemove={() => config.tabs.length > 1}
          removeLabel="Remove tab"
          itemClassName={tab =>
            `${configFormStyles.tabItem} ${tab.id === activeId ? configFormStyles.tabItemSelected : ''}`
          }
          onItemClick={tab => setSelectedId(tab.id)}
          renderItem={(tab, { update }) => (
            <TextInput
              value={tab.label}
              aria-label="Tab label"
              onFocus={() => setSelectedId(tab.id)}
              onChange={value => update({ label: value ?? '' })}
            />
          )}
        />
      </div>

      <div className={configFormStyles.content}>
        {activeTab && (
          <TabContentsEditor
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
