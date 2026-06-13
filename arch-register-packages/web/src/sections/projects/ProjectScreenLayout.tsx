import { Fragment, type ReactNode } from 'react';
import styles from './ProjectDetailScreen.module.css';

type Breadcrumb = {
  label: ReactNode;
  onClick?: () => void;
};

type ProjectScreenLayoutProps = {
  breadcrumbs: Breadcrumb[];
  title: ReactNode;
  titleSuffix?: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
};

export const ProjectScreenLayout = ({
  breadcrumbs,
  title,
  titleSuffix,
  description,
  error,
  actions,
  meta,
  toolbar,
  children
}: ProjectScreenLayoutProps) => {
  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <div>
          <div className={styles.eyebrow}>
            {breadcrumbs.map((breadcrumb, index) => (
              <Fragment key={index}>
                {index > 0 && ' / '}
                {breadcrumb.onClick ? (
                  <button type="button" onClick={breadcrumb.onClick}>
                    {breadcrumb.label}
                  </button>
                ) : (
                  breadcrumb.label
                )}
              </Fragment>
            ))}
          </div>
          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {titleSuffix}
          </div>
          {description}
          {error}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>

      {meta ? <div className={styles.meta}>{meta}</div> : null}
      {toolbar}
      {children}
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
