import type { ReactNode } from 'react';
import { EmptyState } from '../../components/EmptyState';
import { Title, type TitleBreadcrumbItem } from '../../components/Title';
import { Page } from '../../components/Page';

type SchemaEditorScreenShellProps = {
  hasSelection: boolean;
  breadcrumb?: TitleBreadcrumbItem[];
  icon?: ReactNode;
  eyebrow?: ReactNode;
  menu?: ReactNode;
  chips?: ReactNode;
  buttons?: ReactNode;
  title: string;
  titleTestId?: string;
  description?: ReactNode;
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
  chips,
  buttons,
  title,
  titleTestId,
  description,
  editor,
  emptyIcon,
  emptyTitle,
  emptySubtitle,
  emptyAction,
  dialogs
}: SchemaEditorScreenShellProps) => (
  <Page>
    {hasSelection ? (
      <>
        <Title
          breadcrumb={breadcrumb}
          titleTestId={titleTestId}
          icon={icon}
          eyebrow={eyebrow}
          menu={menu}
          chips={chips}
          buttons={buttons}
          title={title}
          description={description}
        />
        {editor}
      </>
    ) : (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        subtitle={emptySubtitle}
        action={emptyAction}
      />
    )}
    {dialogs}
  </Page>
);
