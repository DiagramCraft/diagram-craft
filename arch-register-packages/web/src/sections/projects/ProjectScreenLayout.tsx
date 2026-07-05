import { type ReactNode } from 'react';
import styles from './ProjectDetailScreen.module.css';
import { Title, type TitleBreadcrumbItem } from '../../components/Title';

type ProjectScreenLayoutProps = {
  breadcrumbs: TitleBreadcrumbItem[];
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
  breadcrumbs,
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
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={breadcrumbs}
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

export const ProjectMetaItem = ({
  label,
  value
}: {
  label: string;
  value: ReactNode;
}) => (
  <div className={styles.metaItem}>
    <div className={styles.metaLabel}>{label}</div>
    <div className={styles.metaValue}>{value}</div>
  </div>
);
