import { type ReactNode } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import styles from './ProjectScreenLayout.module.css';
import { Title, type TitleBreadcrumbItem } from '../../../components/Title';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { ProjectSearchParams } from '../../../routes/searchParams';

// Home > Projects > <project>, shared by every project screen.
const useProjectBreadcrumbs = (projectName: string): TitleBreadcrumbItem[] => {
  const navigate = useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const projectId = useParams({ strict: false }).projectId!;
  const search = useSearch({ strict: false }) as ProjectSearchParams;

  return [
    {
      label: 'Home',
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
    },
    {
      label: 'Projects',
      onClick: () => navigate({ to: '/$workspaceSlug/projects', params: { workspaceSlug } })
    },
    {
      label: projectName,
      onClick: () =>
        navigate(
          projectDetailRoute(workspaceSlug, asProjectPublicId(projectId), {
            tab: search.tab,
            section: 'home',
            dialog: undefined,
            contentQuery: search.contentQuery,
            contentView: search.contentView
          })
        )
    }
  ];
};

type ProjectScreenLayoutProps = {
  projectName: string;
  /** Breadcrumbs shown after the project crumb. */
  trailingBreadcrumbs?: TitleBreadcrumbItem[];
  title: string;
  titleSuffix?: ReactNode;
  chips?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  actions?: ReactNode;
  menu?: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};

export const ProjectScreenLayout = ({
  projectName,
  trailingBreadcrumbs = [],
  title,
  titleSuffix,
  chips,
  description,
  error,
  actions,
  menu,
  meta,
  toolbar,
  children
}: ProjectScreenLayoutProps) => {
  const projectBreadcrumbs = useProjectBreadcrumbs(projectName);

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[...projectBreadcrumbs, ...trailingBreadcrumbs]}
          title={title}
          chips={chips}
          description={description}
          toggleButtons={titleSuffix}
          buttons={actions}
          menu={menu}
        />
        {error}
      </div>

      {meta ? <div className={styles.meta}>{meta}</div> : null}
      {toolbar}
      <div className={styles.screenBody}>{children}</div>
    </div>
  );
};

export const ProjectMetaItem = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className={styles.metaItem}>
    <div className={styles.metaLabel}>{label}</div>
    <div className={styles.metaValue}>{value}</div>
  </div>
);
