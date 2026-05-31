import { type KeyboardEvent as ReactKeyboardEvent, useState, useEffect, useRef } from 'react';
import styles from './TopBar.module.css';
import { IconButton } from '../components/IconButton';
import {
  TbMenu2, TbChevronDown, TbChevronRight, TbSearch,
  TbSettings, TbCheck, TbPlus, TbLogout,
  TbFolders, TbDatabase, TbBuildingCommunity,
  TbSun, TbMoon,
} from 'react-icons/tb';
import type { Workspace } from '../api';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';

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
  onNewProject: () => void;
  onNewEntity: () => void;
  canOpenSettings: boolean;
  canAddWorkspace: boolean;
  canNewProject: boolean;
  canNewEntity: boolean;
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
  onNewProject,
  onNewEntity,
  canOpenSettings,
  canAddWorkspace,
  canNewProject,
  canNewEntity,
}: TopBarProps) => {
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
        <AppMenu
          onNewProject={canNewProject ? onNewProject : undefined}
          onNewEntity={canNewEntity ? onNewEntity : undefined}
          onAddWorkspace={canAddWorkspace ? onAddWorkspace : undefined}
          onOpenSettings={canOpenSettings ? onOpenSettings : undefined}
        />
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
        <AccountMenu />
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

const AppMenu = ({
  onNewProject,
  onNewEntity,
  onAddWorkspace,
  onOpenSettings,
}: {
  onNewProject?: () => void;
  onNewEntity?: () => void;
  onAddWorkspace?: () => void;
  onOpenSettings?: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const hasCreateItems = onNewProject ?? onNewEntity;
  const hasItems = hasCreateItems ?? onAddWorkspace ?? onOpenSettings;
  if (!hasItems) return <IconButton title="Menu"><TbMenu2 size={14} /></IconButton>;

  return (
    <div className={styles.appMenu} ref={ref}>
      <IconButton title="Menu" onClick={() => setOpen(o => !o)}>
        <TbMenu2 size={14} />
      </IconButton>
      {open && (
        <div className={styles.appMenuDrop}>
          {hasCreateItems && (
            <>
              <div className={styles.menuLabel}>Create</div>
              {onNewProject && (
                <button type="button" className={styles.menuItem} onClick={() => { setOpen(false); onNewProject(); }}>
                  <TbFolders size={14} /> New project
                </button>
              )}
              {onNewEntity && (
                <button type="button" className={styles.menuItem} onClick={() => { setOpen(false); onNewEntity(); }}>
                  <TbDatabase size={14} /> New entity
                </button>
              )}
            </>
          )}
          {(onAddWorkspace ?? onOpenSettings) && (
            <>
              {hasCreateItems && <div className={styles.menuSep} />}
              {onAddWorkspace && (
                <button type="button" className={styles.menuItem} onClick={() => { setOpen(false); onAddWorkspace(); }}>
                  <TbBuildingCommunity size={14} /> New workspace
                </button>
              )}
              {onOpenSettings && (
                <button type="button" className={styles.menuItem} onClick={() => { setOpen(false); onOpenSettings(); }}>
                  <TbSettings size={14} /> Workspace settings
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

const AccountMenu = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const displayName = user?.display_name ?? '';
  const email = user?.email ?? '';

  return (
    <div className={styles.acctMenu} ref={ref}>
      <button
        type="button"
        className={styles.avatar}
        title={displayName}
        onClick={() => setOpen(o => !o)}
      >
        {getInitials(displayName)}
      </button>
      {open && (
        <div className={styles.acctMenuDrop}>
          <div className={styles.acctHeader}>
            <div className={styles.acctAvatar}>{getInitials(displayName)}</div>
            <div className={styles.acctInfo}>
              <div className={styles.acctName}>{displayName}</div>
              {email && <div className={styles.acctEmail}>{email}</div>}
            </div>
          </div>
          <div className={styles.menuSep} />
          <div className={styles.menuLabel}>Theme</div>
          <ThemeToggle theme={theme} onSetTheme={setTheme} />
          <div className={styles.menuSep} />
          <button
            type="button"
            className={styles.menuItem}
            onClick={() => { setOpen(false); logout(); }}
          >
            <TbLogout size={14} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
};

const ThemeToggle = ({ theme, onSetTheme }: { theme: Theme; onSetTheme: (t: Theme) => void }) => {
  const opts = [
    { value: 'light' as const, label: 'Light', icon: <TbSun size={13} /> },
    { value: 'dark' as const, label: 'Dark', icon: <TbMoon size={13} /> },
  ];
  return (
    <div className={styles.themeToggle} aria-label="Theme">
      {opts.map(o => (
        <button
          key={o.value}
          type="button"
          aria-pressed={theme === o.value}
          className={`${styles.themeOpt} ${theme === o.value ? styles.themeOptActive : ''}`}
          onMouseDown={e => e.stopPropagation()}
          onClick={() => onSetTheme(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
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
