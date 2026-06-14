import type React from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import styles from '../../shell/SidePanel.module.css';

export const SidebarHeader = ({
  children,
  actions
}: {
  children: React.ReactNode;
  actions?: React.ReactNode;
}) => (
  <div className={`${styles.header} ${styles.tabHeader}`}>
    {children}
    {actions ? <div className={styles.headerActions}>{actions}</div> : null}
  </div>
);

export const SidebarTitleHeader = ({
  title,
  actions
}: {
  title: string;
  actions?: React.ReactNode;
}) => (
  <SidebarHeader actions={actions}>
    <Tabs.Root value="section">
      <Tabs.List>
        <Tabs.Trigger value="section">{title}</Tabs.Trigger>
      </Tabs.List>
    </Tabs.Root>
  </SidebarHeader>
);

export const SidebarGroupLabel = ({ children }: { children: React.ReactNode }) => (
  <div className={styles.groupLabel}>{children}</div>
);
