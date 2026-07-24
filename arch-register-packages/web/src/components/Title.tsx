import { Fragment, type ReactNode } from 'react';
import styles from './Title.module.css';

export type TitleBreadcrumbItem = {
  label: string;
  onClick?: () => void;
};

export type TitleProps = {
  breadcrumb?: TitleBreadcrumbItem[];
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
  titleTestId?: string;
  chips?: ReactNode;
  description?: ReactNode;
  toggleButtons?: ReactNode;
  buttons?: ReactNode;
  menu?: ReactNode;
};

export const Title = ({
  breadcrumb,
  icon,
  eyebrow,
  title,
  titleTestId,
  chips,
  description,
  toggleButtons,
  buttons,
  menu
}: TitleProps) => {
  const hasRight = toggleButtons ?? buttons ?? menu;

  return (
    <div className={styles.c}>
      {breadcrumb && breadcrumb.length > 0 && (
        <div className={styles.nav}>
          {breadcrumb.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && <span className={styles.sep}>/</span>}
              {item.onClick ? (
                <button type="button" className={styles.navLink} onClick={item.onClick}>
                  {item.label}
                </button>
              ) : (
                <span className={styles.navCurrent}>{item.label}</span>
              )}
            </Fragment>
          ))}
        </div>
      )}

      <div className={styles.head}>
        <div className={styles.left}>
          <div className={styles.titleRow}>
            {icon && <div className={styles.iconSlot}>{icon}</div>}
            <div className={styles.titleCol}>
              {eyebrow && <div className={styles.eyebrow}>{eyebrow}</div>}
              <div className={styles.titleLine}>
                <h1 className={styles.title} data-testid={titleTestId}>
                  {title}
                </h1>
                {chips && <div className={styles.chips}>{chips}</div>}
              </div>
            </div>
          </div>
          {description && <div className={styles.description}>{description}</div>}
        </div>

        {hasRight && (
          <div className={styles.right}>
            {toggleButtons && <div className={styles.toggles}>{toggleButtons}</div>}
            {buttons && <div className={styles.buttons}>{buttons}</div>}
            {menu}
          </div>
        )}
      </div>
    </div>
  );
};
