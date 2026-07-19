import { useState, type ReactNode } from 'react';
import { useDevConfig } from '../hooks/useDevConfig';
import { DevUserSwitcherPanel } from './DevUserSwitcherPanel';
import styles from './DevTools.module.css';

type DevToolEntry = {
  label: string;
  render: () => ReactNode;
};

const devTools: DevToolEntry[] = [{ label: 'Switch user', render: () => <DevUserSwitcherPanel /> }];

export const DevTools = () => {
  const { data } = useDevConfig();
  const [isOpen, setIsOpen] = useState(false);

  if (!data?.enabled) {
    return null;
  }

  return (
    <>
      <button type="button" className={styles.trigger} onClick={() => setIsOpen(v => !v)}>
        DEV
      </button>
      {isOpen && (
        <div className={styles.panel}>
          {devTools.map(tool => (
            <div key={tool.label}>
              <div className={styles.panelHead}>{tool.label}</div>
              <div className={styles.panelBody}>{tool.render()}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};
