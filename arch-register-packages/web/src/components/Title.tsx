import { Fragment, type ReactNode } from 'react';
import { InlineEditableText } from './InlineEditableText';
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
  /** When set, the title becomes an inline-editable text field. */
  onTitleChange?: (title: string) => void;
  /** When set, the description becomes an inline-editable text field (`description` must be a string). */
  onDescriptionChange?: (description: string) => void;
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
  onTitleChange,
  onDescriptionChange,
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
                  {onTitleChange ? (
                    <InlineEditableText
                      value={title}
                      ariaLabel="Name"
                      placeholder="Name"
                      testId="dashboard-name-input"
                      onChange={onTitleChange}
                    />
                  ) : (
                    title
                  )}
                </h1>
                {chips && <div className={styles.chips}>{chips}</div>}
              </div>
            </div>
          </div>
          {onDescriptionChange ? (
            <div className={styles.description}>
              <InlineEditableText
                value={typeof description === 'string' ? description : ''}
                ariaLabel="Description"
                placeholder="Add a description"
                testId="dashboard-description-input"
                onChange={onDescriptionChange}
              />
            </div>
          ) : (
            description && <div className={styles.description}>{description}</div>
          )}
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
