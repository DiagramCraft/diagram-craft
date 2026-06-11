import { type KeyboardEvent as ReactKeyboardEvent, useState, useEffect, useRef } from 'react';
import styles from './TopBar.module.css';
import { TopBar as SharedTopBar } from '@diagram-craft/app-components/TopBar';
import { HamburgerMenu } from '@diagram-craft/app-components/HamburgerMenu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/Menu';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import {
  TbChevronDown,
  TbChevronRight,
  TbSearch,
  TbSettings,
  TbCheck,
  TbPlus,
  TbLogout,
  TbFolders,
  TbDatabase,
  TbBuildingCommunity,
  TbSun,
  TbMoon,
  TbUser,
  TbBell,
  TbX
} from 'react-icons/tb';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';
import { resolveAvatarBackground } from '../components/MemberAvatar';
import {
  useClearNotifications,
  useDeleteNotification,
  useDeleteWatch,
  useNotificationCount,
  useNotifications,
  useWatchedEntities
} from '../hooks/useNotifications';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { NotificationItem, WatchedEntity } from '@arch-register/api-types/watchContract';

type BreadcrumbItem = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
};

type TopBarProps = {
  workspaces: Workspace[];
  currentWs: string;
  workspaceSlug: string;
  onPickWs: (id: string) => void;
  trail: BreadcrumbItem[];
  query: string;
  onQueryChange: (q: string) => void;
  onQuerySubmit: (q: string) => void;
  onOpenSettings: () => void;
  onOpenGlobalSettings: () => void;
  onAddWorkspace: () => void;
  onNewProject: () => void;
  onNewEntity: () => void;
  canOpenSettings: boolean;
  canOpenGlobalSettings: boolean;
  canAddWorkspace: boolean;
  canNewProject: boolean;
  canNewEntity: boolean;
  hideWorkspaceSwitcher?: boolean;
  hideSearch?: boolean;
};

export const TopBar = ({
  workspaces,
  currentWs,
  workspaceSlug,
  onPickWs,
  trail,
  query,
  onQueryChange,
  onQuerySubmit,
  onOpenSettings,
  onOpenGlobalSettings,
  onAddWorkspace,
  onNewProject,
  onNewEntity,
  canOpenSettings,
  canOpenGlobalSettings,
  canAddWorkspace,
  canNewProject,
  canNewEntity,
  hideWorkspaceSwitcher = false,
  hideSearch = false
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
    <SharedTopBar
      className={styles.topbar}
      leftSlot={
        <AppMenu
          onNewProject={canNewProject ? onNewProject : undefined}
          onNewEntity={canNewEntity ? onNewEntity : undefined}
          onAddWorkspace={canAddWorkspace ? onAddWorkspace : undefined}
          onOpenSettings={canOpenSettings ? onOpenSettings : undefined}
          onOpenGlobalSettings={canOpenGlobalSettings ? onOpenGlobalSettings : undefined}
          showDisabledItems={hideWorkspaceSwitcher}
        />
      }
    >
      <div className={styles.left}>
        {!hideWorkspaceSwitcher && (
          <>
            <div className={styles.sep} />
            <WorkspaceSwitcher
              workspaces={workspaces}
              current={currentWs}
              onPick={onPickWs}
              onAddWorkspace={onAddWorkspace}
              canAddWorkspace={canAddWorkspace}
            />
          </>
        )}
        <div className={styles.sep} />
        <Breadcrumbs trail={trail} />
      </div>
      <div className={styles.center}>
        {!hideSearch && (
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
        )}
      </div>
      <div className={styles.right}>
        <NotificationMenu workspaceSlug={workspaceSlug} />
        <AccountMenu />
      </div>
    </SharedTopBar>
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
  canAddWorkspace
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
      <button
        type="button"
        className={styles.wsBtn}
        aria-label="Workspace selector"
        onClick={() => setOpen(o => !o)}
      >
        <span
          className={styles.wsBadge}
          style={
            ws.color
              ? {
                  background: `linear-gradient(135deg, ${ws.color}, color-mix(in oklch, ${ws.color} 60%, oklch(0.35 0.12 290)))`
                }
              : undefined
          }
        >
          {ws.short_code}
        </span>
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
              <span
                className={styles.wsBadge}
                style={{
                  marginRight: 8,
                  ...(w.color
                    ? {
                        background: `linear-gradient(135deg, ${w.color}, color-mix(in oklch, ${w.color} 60%, oklch(0.35 0.12 290)))`
                      }
                    : {})
                }}
              >
                {w.short_code}
              </span>
              <span style={{ flex: 1 }}>
                <div>{w.name}</div>
                {w.description && <div className={styles.menuSub}>{w.description}</div>}
              </span>
              {w.id === current && <TbCheck size={14} />}
            </button>
          ))}
          {canAddWorkspace && (
            <>
              <div className={styles.menuSep} />
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setOpen(false);
                  onAddWorkspace();
                }}
              >
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
  onOpenGlobalSettings,
  showDisabledItems = false
}: {
  onNewProject?: () => void;
  onNewEntity?: () => void;
  onAddWorkspace?: () => void;
  onOpenSettings?: () => void;
  onOpenGlobalSettings?: () => void;
  showDisabledItems?: boolean;
}) => {
  const hasCreateItems = onNewProject ?? onNewEntity;
  const hasItems =
    hasCreateItems ?? onAddWorkspace ?? onOpenSettings ?? onOpenGlobalSettings ?? showDisabledItems;

  if (!hasItems) return <HamburgerMenu>{null}</HamburgerMenu>;

  return (
    <HamburgerMenu align="start">
      {(hasCreateItems || showDisabledItems) && (
        <>
          <div className={styles.menuLabel}>Create</div>
          <Menu.Item
            leftSlot={<TbFolders size={14} />}
            disabled={!onNewProject}
            onClick={onNewProject}
          >
            New project
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbDatabase size={14} />}
            disabled={!onNewEntity}
            onClick={onNewEntity}
          >
            New entity
          </Menu.Item>
        </>
      )}
      {(onAddWorkspace ?? onOpenSettings ?? onOpenGlobalSettings ?? showDisabledItems) && (
        <>
          {(hasCreateItems || showDisabledItems) && <Menu.Separator />}
          <Menu.Item
            leftSlot={<TbBuildingCommunity size={14} />}
            disabled={!onAddWorkspace}
            onClick={onAddWorkspace}
          >
            New workspace
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbSettings size={14} />}
            disabled={!onOpenSettings}
            onClick={onOpenSettings}
          >
            Workspace settings
          </Menu.Item>
          {onOpenGlobalSettings && (
            <Menu.Item leftSlot={<TbSettings size={14} />} onClick={onOpenGlobalSettings}>
              Global settings
            </Menu.Item>
          )}
        </>
      )}
    </HamburgerMenu>
  );
};

const AccountMenu = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const displayName = user?.display_name ?? '';
  const email = user?.email ?? '';
  const avatarColor = resolveAvatarBackground(user?.id ?? '', user?.color);

  return (
    <MenuButton.Root>
      <MenuButton.Trigger
        element={
          <button
            type="button"
            className={styles.avatar}
            title={displayName}
            aria-label="Account menu"
            style={{ background: avatarColor }}
          >
            {getInitials(displayName)}
          </button>
        }
      />
      <MenuButton.Menu align="end">
        <div aria-label="Account menu content">
          <div className={styles.acctHeader}>
            <div className={styles.acctAvatar} style={{ background: avatarColor }}>
              {getInitials(displayName)}
            </div>
            <div className={styles.acctInfo}>
              <div className={styles.acctName}>{displayName}</div>
              {email && <div className={styles.acctEmail}>{email}</div>}
            </div>
          </div>
          <Menu.Separator />
          <Menu.Item
            leftSlot={<TbUser size={14} />}
            onClick={() =>
              navigate({
                to: '/$workspaceSlug/account',
                params: { workspaceSlug: window.location.pathname.split('/')[1] ?? '' }
              })
            }
          >
            Account Settings
          </Menu.Item>
          <Menu.Separator />
          <div className={styles.menuLabel}>Theme</div>
          <ThemeToggle theme={theme} onSetTheme={setTheme} />
          <Menu.Separator />
          <Menu.Item leftSlot={<TbLogout size={14} />} onClick={logout}>
            Sign out
          </Menu.Item>
        </div>
      </MenuButton.Menu>
    </MenuButton.Root>
  );
};

const NotificationMenu = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'notifications' | 'watching'>('notifications');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: count } = useNotificationCount(workspaceSlug, !!workspaceSlug);
  const { data: notifications = [] } = useNotifications(workspaceSlug, open && !!workspaceSlug);
  const { data: watched = [] } = useWatchedEntities(workspaceSlug, open && !!workspaceSlug);
  const clearNotificationsMutation = useClearNotifications(workspaceSlug);
  const deleteNotificationMutation = useDeleteNotification(workspaceSlug);
  const deleteWatchMutation = useDeleteWatch(workspaceSlug);
  const notificationCount = count?.count ?? 0;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const openEntity = (entityId: string) => {
    setOpen(false);
    navigate({
      to: '/$workspaceSlug/entities/$entityId',
      params: { workspaceSlug, entityId }
    });
  };

  return (
    <div className={styles.notificationMenu} ref={ref}>
      <button
        type="button"
        className={styles.notificationTrigger}
        aria-label="Notifications"
        title="Notifications"
        onClick={() => setOpen(value => !value)}
      >
        <TbBell size={15} />
        {notificationCount > 0 && (
          <span className={styles.notificationBadge}>
            {notificationCount > 9 ? '9+' : notificationCount}
          </span>
        )}
      </button>
      {open && (
        <div className={styles.notificationDrop}>
          <div className={styles.notificationTabsRow}>
            <Tabs.Root
              value={tab}
              onValueChange={value => setTab(value as 'notifications' | 'watching')}
            >
              <Tabs.List>
                <Tabs.Trigger value="notifications">
                  Notifications
                  {notificationCount > 0 && (
                    <span className={styles.notifTabPill}>{notificationCount}</span>
                  )}
                </Tabs.Trigger>
                <Tabs.Trigger value="watching">Watching</Tabs.Trigger>
              </Tabs.List>
            </Tabs.Root>
            {tab === 'notifications' && notifications.length > 0 && (
              <button
                type="button"
                className={styles.notificationAction}
                disabled={clearNotificationsMutation.isPending}
                onClick={() => clearNotificationsMutation.mutate()}
              >
                Mark all read
              </button>
            )}
          </div>
          <div className={styles.notificationPanel}>
            {tab === 'notifications' ? (
              <NotificationList
                notifications={notifications}
                onOpenEntity={openEntity}
                onClear={notificationId => deleteNotificationMutation.mutate(notificationId)}
                clearingId={deleteNotificationMutation.variables ?? null}
                isClearing={deleteNotificationMutation.isPending}
              />
            ) : (
              <WatchingList
                watched={watched}
                onOpenEntity={openEntity}
                onUnwatch={entityId => deleteWatchMutation.mutate(entityId)}
                unwatchingId={deleteWatchMutation.variables ?? null}
                isUnwatching={deleteWatchMutation.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationList = ({
  notifications,
  onOpenEntity,
  onClear,
  clearingId,
  isClearing
}: {
  notifications: NotificationItem[];
  onOpenEntity: (entityId: string) => void;
  onClear: (notificationId: string) => void;
  clearingId: string | null;
  isClearing: boolean;
}) => {
  if (notifications.length === 0) {
    return (
      <div className={styles.notificationEmpty}>
        <span>No notifications yet</span>
        <span>Changes on watched entities will show up here.</span>
      </div>
    );
  }

  return (
    <div className={styles.notificationList}>
      {notifications.map(item => (
        <button
          key={item.id}
          type="button"
          className={`${styles.notificationRow} ${styles.notificationRowUnread}`}
          aria-label={`Notification: ${item.entity_name}`}
          onClick={() => {
            if (item.operation !== 'delete') onOpenEntity(item.entity_id);
          }}
        >
          <div className={styles.notifDot} />
          <div className={styles.notificationRowMain}>
            <div className={styles.notificationEntity}>{item.entity_name}</div>
            <div className={styles.notificationMeta}>
              <span>{item.changed_by_display_name}</span>
              <span className={styles.notificationSep}>·</span>
              <span className={styles.notificationOp}>{item.operation}</span>
            </div>
          </div>
          <div className={styles.notificationWhen}>{formatRelativeTimestamp(item.timestamp)}</div>
          <span
            className={styles.notificationClear}
            aria-label={`Clear notification for ${item.entity_name}`}
            title={`Clear notification for ${item.entity_name}`}
            onClick={event => {
              event.stopPropagation();
              onClear(item.id);
            }}
          >
            <TbX size={12} />
            <span className={styles.srOnly}>
              {isClearing && clearingId === item.id ? 'Clearing' : 'Clear notification'}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
};

const WatchingList = ({
  watched,
  onOpenEntity,
  onUnwatch,
  unwatchingId,
  isUnwatching
}: {
  watched: WatchedEntity[];
  onOpenEntity: (entityId: string) => void;
  onUnwatch: (entityId: string) => void;
  unwatchingId: string | null;
  isUnwatching: boolean;
}) => {
  if (watched.length === 0) {
    return (
      <div className={styles.notificationEmpty}>
        <span>Nothing watched yet</span>
        <span>Open an entity and click the bell icon to start watching it.</span>
      </div>
    );
  }

  return (
    <div className={styles.notificationList}>
      {watched.map(item => (
        <button
          key={item.entity_id}
          type="button"
          className={styles.notificationRow}
          aria-label={`Watching: ${item.entity_name}`}
          onClick={() => onOpenEntity(item.entity_id)}
        >
          <div className={styles.notificationRowMain}>
            <div className={styles.notificationEntity}>{item.entity_name}</div>
            <div className={styles.notificationMeta}>
              <span>{item.entity_slug}</span>
            </div>
          </div>
          <span
            className={styles.watchingUnwatch}
            aria-label={`Unwatch ${item.entity_name}`}
            title={
              isUnwatching && unwatchingId === item.entity_id ? 'Removing watch' : 'Unwatch entity'
            }
            onClick={event => {
              event.stopPropagation();
              onUnwatch(item.entity_id);
            }}
          >
            <TbBell size={12} />
          </span>
        </button>
      ))}
    </div>
  );
};

const formatRelativeTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const ThemeToggle = ({ theme, onSetTheme }: { theme: Theme; onSetTheme: (t: Theme) => void }) => {
  const opts = [
    { value: 'light' as const, label: 'Light', icon: <TbSun size={13} /> },
    { value: 'dark' as const, label: 'Dark', icon: <TbMoon size={13} /> }
  ];
  return (
    <div className={styles.themeToggle}>
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
