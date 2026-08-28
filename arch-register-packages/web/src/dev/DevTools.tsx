import { useEffect, useState, type ReactNode } from 'react';
import { useDevConfig } from '../hooks/useDevConfig';
import { router } from '../router';
import { DevUserSwitcherPanel } from './DevUserSwitcherPanel';
import { DevTracePanel } from './DevTracePanel';
import { initDevTrace, recordNavigation, setDevTracingEnabled } from './devTrace';
import styles from './DevTools.module.css';

type DevToolEntry = {
  label: string;
  visible: (config: { enabled: boolean; tracingEnabled: boolean }) => boolean;
  render: () => ReactNode;
};

const devTools: DevToolEntry[] = [
  {
    label: 'Switch user',
    visible: config => config.enabled,
    render: () => <DevUserSwitcherPanel />
  },
  {
    label: 'Traces',
    visible: config => config.tracingEnabled,
    render: () => <DevTracePanel />
  }
];

export const DevTools = () => {
  const { data } = useDevConfig();
  const [isOpen, setIsOpen] = useState(false);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const tracingEnabled = data?.tracingEnabled ?? false;

  useEffect(() => {
    setDevTracingEnabled(tracingEnabled);
    if (!tracingEnabled) return;
    initDevTrace();
    // Use onBeforeNavigate (not onResolved) so the interaction is active before
    // route loaders and query refetches fire — otherwise their requests race
    // ahead of the interaction and are never attributed to it.
    return router.subscribe('onBeforeNavigate', ({ toLocation, fromLocation }) => {
      if (fromLocation && toLocation.href === fromLocation.href) return;
      recordNavigation(toLocation.pathname + toLocation.searchStr);
    });
  }, [tracingEnabled]);

  if (!data?.enabled && !tracingEnabled) {
    return null;
  }

  const config = { enabled: data?.enabled ?? false, tracingEnabled };
  const visibleTools = devTools.filter(tool => tool.visible(config));
  const activeTool =
    visibleTools.find(tool => tool.label === activeLabel) ?? visibleTools[0];

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-dev-trace-ignore
        onClick={() => setIsOpen(v => !v)}
      >
        DEV
      </button>
      {isOpen && activeTool && (
        <div className={styles.panel} data-dev-trace-ignore>
          <div className={styles.tabs}>
            {visibleTools.map(tool => (
              <button
                key={tool.label}
                type="button"
                className={styles.tab}
                data-active={tool.label === activeTool.label ? 'true' : undefined}
                onClick={() => setActiveLabel(tool.label)}
              >
                {tool.label}
              </button>
            ))}
          </div>
          <div className={styles.panelBody}>{activeTool.render()}</div>
        </div>
      )}
    </>
  );
};
