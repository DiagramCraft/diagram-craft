import { useState } from 'react';
import styles from './TopBar.module.css';
import { IconButton } from '../components/IconButton';
import {
  TbMenu2, TbChevronDown, TbChevronRight, TbSearch, TbBell,
  TbSettings, TbCheck, TbPlus,
} from 'react-icons/tb';
import type { Workspace } from '../data';

type BreadcrumbItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

type TopBarProps = {
  workspaces: Workspace[];
  currentWs: string;
  onPickWs: (id: string) => void;
  trail: BreadcrumbItem[];
  query: string;
  onQuery: (q: string) => void;
  onOpenSettings: () => void;
};

export const TopBar = ({
  workspaces,
  currentWs,
  onPickWs,
  trail,
  query,
  onQuery,
  onOpenSettings,
}: TopBarProps) => (
  <div className={styles.topbar}>
    <div className={styles.left}>
      <IconButton title="Menu">
        <TbMenu2 size={14} />
      </IconButton>
      <div className={styles.sep} />
      <WorkspaceSwitcher
        workspaces={workspaces}
        current={currentWs}
        onPick={onPickWs}
        onOpenSettings={onOpenSettings}
      />
      <div className={styles.sep} />
      <Breadcrumbs trail={trail} />
    </div>
    <div className={styles.center}>
      <div className={styles.search}>
        <TbSearch size={12} />
        <input
          placeholder="Search entities, diagrams, projects..."
          value={query}
          onChange={e => onQuery(e.target.value)}
        />
        <span className={styles.kbd}>&#8984;K</span>
      </div>
    </div>
    <div className={styles.right}>
      <IconButton title="Notifications">
        <TbBell size={14} />
      </IconButton>
      <IconButton title="Workspace settings" onClick={onOpenSettings}>
        <TbSettings size={14} />
      </IconButton>
      <div className={styles.avatar} title="Anika P.">
        AP
      </div>
    </div>
  </div>
);

const WorkspaceSwitcher = ({
  workspaces,
  current,
  onPick,
  onOpenSettings,
}: {
  workspaces: Workspace[];
  current: string;
  onPick: (id: string) => void;
  onOpenSettings: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ws = workspaces.find(w => w.id === current) ?? workspaces[0]!;

  return (
    <div className={styles.wsSwitcher} onMouseLeave={() => setOpen(false)}>
      <button type="button" className={styles.wsBtn} onClick={() => setOpen(o => !o)}>
        <span className={styles.wsBadge}>{ws.short}</span>
        <span className={styles.wsName}>{ws.name}</span>
        <TbChevronDown size={12} />
      </button>
      {open && (
        <div className={styles.wsMenu}>
          <div className={styles.menuLabel}>Workspaces</div>
          {workspaces.map(w => (
            <button
              type="button"
              key={w.id}
              className={`${styles.menuItem} ${w.id === current ? styles.menuItemActive : ''}`}
              onClick={() => {
                onPick(w.id);
                setOpen(false);
              }}
            >
              <span className={styles.wsBadge} style={{ marginRight: 8 }}>
                {w.short}
              </span>
              <span style={{ flex: 1 }}>
                <div>{w.name}</div>
                <div className={styles.menuSub}>
                  {w.entities} entities &middot; {w.projects} projects
                </div>
              </span>
              {w.id === current && <TbCheck size={14} />}
            </button>
          ))}
          <div className={styles.menuSep} />
          <button type="button" className={styles.menuItem}>
            <TbPlus size={12} /> New workspace...
          </button>
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => {
              setOpen(false);
              onOpenSettings();
            }}
          >
            <TbSettings size={12} /> Workspace settings
          </button>
        </div>
      )}
    </div>
  );
};

const Breadcrumbs = ({ trail }: { trail: BreadcrumbItem[] }) => (
  <div className={styles.crumbs}>
    {trail.map((c, i) => (
      <span key={i} style={{ display: 'contents' }}>
        {i > 0 && <TbChevronRight size={10} />}
        <button
          type="button"
          className={`${styles.crumb} ${i === trail.length - 1 ? styles.crumbLast : ''}`}
          onClick={c.onClick}
        >
          {c.icon}
          <span>{c.label}</span>
        </button>
      </span>
    ))}
  </div>
);

export type { BreadcrumbItem };
