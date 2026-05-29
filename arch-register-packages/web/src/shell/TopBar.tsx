import { type KeyboardEvent as ReactKeyboardEvent, useState, useEffect, useRef } from 'react';
import styles from './TopBar.module.css';
import { IconButton } from '../components/IconButton';
import {
  TbMenu2, TbChevronDown, TbChevronRight, TbSearch,
  TbSettings, TbCheck, TbPlus, TbLogout,
} from 'react-icons/tb';
import type { Workspace } from '../api';
import { useAuth } from '../auth/AuthContext';
import { DropdownMenu } from '../components/DropdownMenu';

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
  onQueryChange: (q: string) => void;
  onQuerySubmit: (q: string) => void;
  onOpenSettings: () => void;
  onAddWorkspace: () => void;
  canOpenSettings: boolean;
  canAddWorkspace: boolean;
};

export const TopBar = ({
  workspaces,
  currentWs,
  onPickWs,
  trail,
  query,
  onQueryChange,
  onQuerySubmit,
  onOpenSettings,
  onAddWorkspace,
  canOpenSettings,
  canAddWorkspace,
}: TopBarProps) => {
  const { user, logout } = useAuth();
  const searchRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    onQuerySubmit(query);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
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
          onAddWorkspace={onAddWorkspace}
          canAddWorkspace={canAddWorkspace}
        />
        <div className={styles.sep} />
        <Breadcrumbs trail={trail} />
      </div>
      <div className={styles.center}>
        <div className={styles.search}>
          <TbSearch size={12} />
          <input
            ref={searchRef}
            placeholder="Search entities, diagrams, projects..."
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className={styles.kbd}>&#8984;K</span>
        </div>
      </div>
      <div className={styles.right}>
        {canOpenSettings && (
          <IconButton title="Workspace settings" onClick={onOpenSettings}>
            <TbSettings size={14} />
          </IconButton>
        )}
        <DropdownMenu
          trigger={
            <div className={styles.avatar} title={user?.display_name ?? ''}>
              {getInitials(user?.display_name ?? '')}
            </div>
          }
          header={<>Signed in as <strong>{user?.display_name}</strong></>}
          items={[
            { label: 'Log out', icon: <TbLogout size={14} />, onClick: logout },
          ]}
        />
      </div>
    </div>
  );
};

const getInitials = (name: string) =>
  name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const WorkspaceSwitcher = ({
  workspaces,
  current,
  onPick,
  onAddWorkspace,
  canAddWorkspace,
}: {
  workspaces: Workspace[];
  current: string;
  onPick: (id: string) => void;
  onAddWorkspace: () => void;
  canAddWorkspace: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ws = workspaces.find(w => w.id === current) ?? workspaces[0];

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!ws) return null;

  return (
    <div className={styles.wsSwitcher} ref={ref}>
      <button type="button" className={styles.wsBtn} onClick={() => setOpen(o => !o)}>
        <span className={styles.wsBadge}>{ws.short_code}</span>
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
                {w.short_code}
              </span>
              <span style={{ flex: 1 }}>
                <div>{w.name}</div>
                {w.description && (
                  <div className={styles.menuSub}>{w.description}</div>
                )}
              </span>
              {w.id === current && <TbCheck size={14} />}
            </button>
          ))}
          {canAddWorkspace && (
            <>
              <div className={styles.menuSep} />
              <button type="button" className={styles.menuItem} onClick={() => { setOpen(false); onAddWorkspace(); }}>
                <TbPlus size={12} /> New workspace...
              </button>
            </>
          )}
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
