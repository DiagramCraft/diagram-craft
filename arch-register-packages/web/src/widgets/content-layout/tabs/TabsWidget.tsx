import { useNavigate, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { NestedWidgetRenderer } from '../../shared/dashboard/nestedWidgets';
import styles from './TabsWidget.module.css';
import { useState } from 'react';
import { resolveActiveTabId, type TabsWidgetConfig } from './tabsLogic';

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
