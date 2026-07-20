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
  TbMessageCircle,
  TbX
} from 'react-icons/tb';
import { useNavigate } from '@tanstack/react-router';
import { useAuth } from '../auth/AuthContext';
import { useTheme } from '../hooks/useTheme';
import type { Theme } from '../hooks/useTheme';
import { resolveAvatarBackground } from '../components/MemberAvatar';
import { SearchInput } from '../components/SearchInput';
import {
  useClearNotifications,
  useDeleteNotification,
  useDeleteWatch,
  useNotificationCount,
  useNotifications,
  useWatchedEntities
} from '../hooks/useNotifications';
import { useDiscussionSummary } from '../hooks/useDiscussions';
import { formatRelativeTime } from '../utils/dateFormat';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { NotificationItem, WatchedEntity } from '@arch-register/api-types/watchContract';
import type { DiscussionSummaryEntry } from '@arch-register/api-types/discussionContract';
import type { BreadcrumbItem } from './shellTypes';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  entityMarkdownRoute,
  projectMarkdownRoute,
  workspaceMarkdownRoute
} from '../routes/publicObjectRoutes';
import { useDismissibleMenu } from '../hooks/useDismissibleMenu';
import { discussionRoute } from './topBarViewModel';

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
          <SearchInput
            ref={searchRef}
            size="sm"
            className={styles.search}
            placeholder="Search entities, diagrams, projects..."
            value={query}
            onChange={onQueryChange}
            onKeyDown={handleKeyDown}
          >
            <span className={styles.kbd}>&#8984;K</span>
          </SearchInput>
        )}
      </div>
      <div className={styles.right}>
        <DiscussionsMenu workspaceSlug={workspaceSlug} />
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
  const { open, setOpen, ref } = useDismissibleMenu<HTMLDivElement>();
  const ws = workspaces.find(w => w.id === current) ?? workspaces[0];

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
        <div data-testid="account-menu-content">
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

const DiscussionsMenu = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const { open, setOpen, ref } = useDismissibleMenu<HTMLDivElement>();
  const { data: entries = [] } = useDiscussionSummary(workspaceSlug, !!workspaceSlug);

  const openEntry = (entry: DiscussionSummaryEntry) => {
    setOpen(false);
    navigate(discussionRoute(workspaceSlug, entry));
  };

  return (
    <div className={styles.notificationMenu} ref={ref}>
      <button
        type="button"
        className={styles.notificationTrigger}
        aria-label="Discussions"
        title="Discussions"
        onClick={() => setOpen(value => !value)}
      >
        <TbMessageCircle size={15} />
        {entries.length > 0 && <span className={styles.notificationBadge}>{entries.length}</span>}
      </button>
      {open && (
        <div className={styles.notificationDrop}>
          <div className={styles.discussionsHeader}>
            <span>Discussions</span>
          </div>
          <div className={styles.notificationPanel}>
            {entries.length === 0 ? (
              <div className={styles.notificationEmpty}>
                <span>No discussions yet</span>
                <span>Threads on entities, assessments, and pages show up here.</span>
              </div>
            ) : (
              <div className={styles.notificationList}>
                {entries.map(entry => (
                  <button
                    key={`${entry.objectType}:${entry.objectId}`}
                    type="button"
                    className={styles.notificationRow}
                    aria-label={`Discussion: ${entry.objectTitle}`}
                    onClick={() => openEntry(entry)}
                  >
                    <div className={styles.notificationRowMain}>
                      <div className={styles.notificationEntity}>{entry.objectTitle}</div>
                      <div className={styles.notificationMeta}>
                        <span>{entry.lastPost.authorName}</span>
                        <span className={styles.notificationSep}>·</span>
                        <span>
                          {entry.postCount} post{entry.postCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <div className={styles.notificationWhen}>
                      {formatRelativeTime(entry.lastPost.createdAt)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NotificationMenu = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'notifications' | 'watching'>('notifications');
  const { open, setOpen, ref } = useDismissibleMenu<HTMLDivElement>();
  const { data: count } = useNotificationCount(workspaceSlug, !!workspaceSlug);
  const { data: notifications = [] } = useNotifications(workspaceSlug, open && !!workspaceSlug);
  const { data: watched = [] } = useWatchedEntities(workspaceSlug, open && !!workspaceSlug);
  const clearNotificationsMutation = useClearNotifications(workspaceSlug);
  const deleteNotificationMutation = useDeleteNotification(workspaceSlug);
  const deleteWatchMutation = useDeleteWatch(workspaceSlug);
  const notificationCount = count?.count ?? 0;

  const openEntity = (entityId: string) => {
    setOpen(false);
    navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
  };

  const openNotificationRoute = (route: string) => {
    setOpen(false);
    const url = new URL(route, 'http://notification.local');
    const commentId = url.searchParams.get('commentId') ?? undefined;
    const entityWikiMatch = url.pathname.match(/^\/entities\/([^/]+)\/wiki\/([^/]+)$/);
    if (entityWikiMatch) {
      navigate(
        entityMarkdownRoute(
          workspaceSlug,
          asEntityPublicId(decodeURIComponent(entityWikiMatch[1]!)),
          decodeURIComponent(entityWikiMatch[2]!),
          commentId ? { commentId } : undefined
        )
      );
      return;
    }

    const projectWikiMatch = url.pathname.match(/^\/projects\/([^/]+)\/wiki\/([^/]+)$/);
    if (projectWikiMatch) {
      navigate(
        projectMarkdownRoute(
          workspaceSlug,
          asProjectPublicId(decodeURIComponent(projectWikiMatch[1]!)),
          decodeURIComponent(projectWikiMatch[2]!),
          commentId ? { commentId } : undefined
        )
      );
      return;
    }

    const workspaceWikiMatch = url.pathname.match(/^\/content\/wiki\/([^/]+)$/);
    if (workspaceWikiMatch) {
      navigate(
        workspaceMarkdownRoute(
          workspaceSlug,
          decodeURIComponent(workspaceWikiMatch[1]!),
          commentId ? { commentId } : undefined
        )
      );
      return;
    }

    const entityMatch = url.pathname.match(/^\/entities\/([^/]+)$/);
    if (entityMatch) {
      navigate(
        entityDetailRoute(workspaceSlug, asEntityPublicId(decodeURIComponent(entityMatch[1]!)), {
          tab: url.searchParams.get('tab') === 'discussions' ? 'discussions' : undefined
        })
      );
    }
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
            {tab === 'notifications' && notificationCount > 0 && (
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
                onOpenRoute={openNotificationRoute}
                onOpenGovernance={() => {
                  setOpen(false);
                  navigate({ to: '/$workspaceSlug/governance', params: { workspaceSlug } });
                }}
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
  onOpenRoute,
  onOpenGovernance,
  onClear,
  clearingId,
  isClearing
}: {
  notifications: NotificationItem[];
  onOpenEntity: (entityId: string) => void;
  onOpenRoute: (route: string) => void;
  onOpenGovernance: () => void;
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
      {notifications.map(item => {
        const notificationLabel = item.entity_name ?? item.title ?? 'Notification';
        const openNotification = () => {
          if (item.resource_type === 'comment' && item.action_route) {
            onClear(item.id);
            onOpenRoute(item.action_route);
          } else if (item.category === 'action' || item.case_id) {
            onClear(item.id);
            onOpenGovernance();
          } else if (item.operation !== 'delete' && item.entity_public_id) {
            onOpenEntity(item.entity_public_id);
          }
        };
        return (
          // biome-ignore lint/a11y/useSemanticElements: row wraps an interactive clear button; a nested <button> would be invalid HTML
          <div
            key={item.id}
            role="button"
            tabIndex={0}
            className={`${styles.notificationRow} ${item.read_at == null ? styles.notificationRowUnread : ''}`}
            aria-label={`Notification: ${notificationLabel}`}
            onClick={openNotification}
            onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openNotification();
              }
            }}
          >
            <div
              className={`${styles.notifDot} ${item.read_at != null ? styles.notifDotRead : ''}`}
            />
            <div className={styles.notificationRowMain}>
              <div className={styles.notificationEntity}>{item.title ?? item.entity_name}</div>
              <div className={styles.notificationMeta}>
                <span>{item.message ?? item.changed_by_display_name}</span>
                <span className={styles.notificationSep}>·</span>
                <span className={styles.notificationOp}>{item.event_type ?? item.operation}</span>
              </div>
            </div>
            <div className={styles.notificationWhen}>{formatRelativeTime(item.timestamp)}</div>
            <button
              type="button"
              className={styles.notificationClear}
              aria-label={`Clear notification for ${notificationLabel}`}
              title={`Clear notification for ${notificationLabel}`}
              onClick={event => {
                event.stopPropagation();
                onClear(item.id);
              }}
            >
              <TbX size={12} />
              <span className={styles.srOnly}>
                {isClearing && clearingId === item.id ? 'Clearing' : 'Clear notification'}
              </span>
            </button>
          </div>
        );
      })}
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
        // biome-ignore lint/a11y/useSemanticElements: row wraps an interactive unwatch button; a nested <button> would be invalid HTML
        <div
          key={item.entity_id}
          role="button"
          tabIndex={0}
          className={styles.notificationRow}
          aria-label={`Watching: ${item.entity_name}`}
          onClick={() => onOpenEntity(item.entity_public_id)}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onOpenEntity(item.entity_public_id);
            }
          }}
        >
          <div className={styles.notificationRowMain}>
            <div className={styles.notificationEntity}>{item.entity_name}</div>
            <div className={styles.notificationMeta}>
              <span>{item.entity_slug}</span>
            </div>
          </div>
          <button
            type="button"
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
          </button>
        </div>
      ))}
    </div>
  );
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
