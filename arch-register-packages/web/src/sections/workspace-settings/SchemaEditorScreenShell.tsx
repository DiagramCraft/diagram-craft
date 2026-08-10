import type { ReactNode } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Title, type TitleBreadcrumbItem } from '../../components/Title';
import styles from './SchemaSettingsScreen.module.css';

type SchemaEditorScreenShellProps = {
  hasSelection: boolean;
  breadcrumb?: TitleBreadcrumbItem[];
  icon?: ReactNode;
  title: string;
  titleTestId?: string;
  description?: ReactNode;
  headerAction?: ReactNode;
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
  title,
  titleTestId,
  description,
  headerAction,
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
            title={title}
            description={description}
            buttons={headerAction}
          />
        </div>
        {history ?? editor}
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
