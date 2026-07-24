import React, { Fragment } from 'react';
import type { IconType } from 'react-icons';
import { Tooltip } from './Tooltip';
import styles from './NavRail.module.css';

export type NavRailItem = {
  id: string;
  icon: IconType;
  tooltip: React.ReactNode;
  extra?: React.ReactNode;
  separator?: boolean;
};

type NavRailProps = {
  items: NavRailItem[];
  value: string | null;
  onChange: (id: string | null) => void;
  toggle?: boolean;
  side?: 'left' | 'right';
};

export const NavRail = ({
  items,
  value,
  onChange,
  toggle = false,
  side = 'left'
}: NavRailProps) => {
  return (
    <div className={styles.cNavRail} data-side={side}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = value === item.id;
        return (
          <Fragment key={item.id}>
            {item.separator && <div className={styles.eSeparator} />}
            <div className={styles.eItem}>
              <Tooltip
                message={item.tooltip}
                element={
                  <button
                    type="button"
                    className={styles.eButton}
                    aria-label={typeof item.tooltip === 'string' ? item.tooltip : item.id}
                    aria-pressed={isActive}
                    onClick={() => onChange(toggle && isActive ? null : item.id)}
                  >
                    <Icon size={16} />
                  </button>
                }
              />
              {item.extra}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
};
