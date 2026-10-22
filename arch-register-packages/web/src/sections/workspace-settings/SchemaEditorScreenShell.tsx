import type { ReactNode } from 'react';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { EmptyState } from '../../components/EmptyState';
import { Title, type TitleBreadcrumbItem } from '../../components/Title';
import styles from './SchemaSettingsScreen.module.css';

type SchemaEditorScreenShellProps = {
  hasSelection: boolean;
  breadcrumb?: TitleBreadcrumbItem[];
  icon?: ReactNode;
  eyebrow?: ReactNode;
  menu?: ReactNode;
  buttons?: ReactNode;
  title: string;
  titleTestId?: string;
  description?: ReactNode;
  /** When set, an Edit / Version history tab bar is shown below the title. */
  showHistory?: boolean;
  onShowHistoryChange?: (showHistory: boolean) => void;
  history?: ReactNode;
  editor: ReactNode;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptySubtitle?: string;
  emptyAction?: ReactNode;
  dialogs?: ReactNode;
};

export const SchemaEditorScreenShell = ({
  hasSelection,
  breadcrumb,
  icon,
  eyebrow,
  menu,
  buttons,
  title,
  titleTestId,
  description,
  showHistory = false,
  onShowHistoryChange,
  history,
  editor,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  emptyAction,
  dialogs
}: SchemaEditorScreenShellProps) => (
  <div className={styles.screen}>
    {hasSelection ? (
      <div>
        <div className={styles.editorHead}>
          <Title
            breadcrumb={breadcrumb}
            titleTestId={titleTestId}
            icon={icon}
            eyebrow={eyebrow}
            menu={menu}
            buttons={buttons}
            title={title}
            description={description}
          />
        </div>
        {onShowHistoryChange && (
          <Tabs.Root
            value={showHistory ? 'history' : 'edit'}
            onValueChange={value => onShowHistoryChange(value === 'history')}
          >
            <Tabs.List aria-label="Editor views">
              <Tabs.Trigger value="edit">Edit</Tabs.Trigger>
              <Tabs.Trigger value="history">Version history</Tabs.Trigger>
            </Tabs.List>
          </Tabs.Root>
        )}
        <div className={onShowHistoryChange ? styles.viewContent : undefined}>
          {history ?? editor}
        </div>
      </div>
    ) : (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        subtitle={emptySubtitle}
        action={emptyAction}
      />
    )}
    {dialogs}
  </div>
);
