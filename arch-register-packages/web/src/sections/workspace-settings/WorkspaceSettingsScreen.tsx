import { lazy, Suspense, useState, useEffect } from 'react';
import styles from './WorkspaceSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { GeneralSubSection } from './sub-sections/GeneralSubSection';
import { LifecycleSubSection } from './sub-sections/LifecycleSubSection';
import { AuditLogSubSection } from './sub-sections/AuditLogSubSection';
import { DangerZoneSubSection } from './sub-sections/DangerZoneSubSection';
import { RolesPermissionsSubSection } from './sub-sections/RolesPermissionsSubSection';
import { MembersSubSection } from './sub-sections/MembersSubSection';
import { TeamsSubSection } from './sub-sections/TeamsSubSection';
import { AiSettingsSubSection } from './sub-sections/AiSettingsSubSection';
import { ExportImportSubSection } from './sub-sections/ExportImportSubSection';
import { RoutePendingComponent } from '../../routes/RoutePendingComponent';
import { JobMonitoringSubSection } from './sub-sections/JobMonitoringSubSection';
import { WebhooksSubSection } from './sub-sections/WebhooksSubSection';

const WorkspaceAnalyticsScreen = lazy(() =>
  import('./sub-sections/analytics/WorkspaceAnalyticsScreen').then(module => ({
    default: module.WorkspaceAnalyticsScreen
  }))
);

const SECTION_META: Record<string, { title: string; sub: string }> = {
  'general': { title: 'General', sub: 'Name, description, and identity for this workspace.' },
  'lifecycle-owners': {
    title: 'Lifecycle',
    sub: 'Configure valid lifecycle states for entities in this workspace.'
  },
  'model-overview': {
    title: 'Model Overview',
    sub: 'Visualize relationships between entity types in your data model.'
  },
  'schemas': {
    title: 'Schemas',
    sub: 'Define entity types, fields, and enums that structure your workspace data.'
  },
  'roles': {
    title: 'Roles & permissions',
    sub: 'Manage built-in roles and create custom workspace roles.'
  },
  'teams': {
    title: 'Teams',
    sub: 'Manage owner teams and assign users a team role for owned entities and projects.'
  },
  'members': {
    title: 'Members',
    sub: 'Browse workspace members and the role assigned to each person.'
  },
  'ai': {
    title: 'AI',
    sub: 'Configure the AI provider, model, and system prompt for the Assistant and Extract features.'
  },
  'export-import': {
    title: 'Export & Import',
    sub: 'Export workspace data to ZIP archive or import data from another workspace.'
  },
  'analytics': {
    title: 'Analytics',
    sub: 'Review workspace-wide catalog coverage, lifecycle distribution, ownership gaps, and completeness.'
  },
  'audit': {
    title: 'Audit log',
    sub: 'Browse recent activity across the workspace with filters for object type and date range.'
  },
  'jobs': {
    title: 'Job monitoring',
    sub: 'Monitor system-owned scheduled work and cancel queued runs.'
  },
  'webhooks': {
    title: 'Webhooks',
    sub: 'Notify external systems when catalog entities change.'
  },
  'danger': {
    title: 'Danger zone',
    sub: "Operations that can't be undone. Read carefully before clicking."
  }
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/$section');

export const WorkspaceSettingsScreen = () => {
  const navigate = routeApi.useNavigate();
  const params = routeApi.useParams();
  const search = routeApi.useSearch();
  const ctx = useWorkspaceContext();
  const workspace = ctx.workspace;
  const workspaceSlug = ctx.workspaceSlug;
  const lifecycleStates = ctx.lifecycleStates;
  const availableSections = ctx.availableSettingsSections;
  const section = params.section ?? 'general';
  const sectionIsValid = availableSections.includes(section);
  const [membersAddDialogOpen, setMembersAddDialogOpen] = useState(false);
  const [teamsAddDialogOpen, setTeamsAddDialogOpen] = useState(false);
  const [rolesAddDialogOpen, setRolesAddDialogOpen] = useState(false);

  useEffect(() => {
    if (sectionIsValid || !ctx.defaultSettingsSection) return;
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug, section: ctx.defaultSettingsSection },
      replace: true
    });
  }, [sectionIsValid, ctx.defaultSettingsSection, navigate, workspaceSlug]);

  const meta = SECTION_META[section] ?? SECTION_META['general']!;

  if (!workspace) return null;

  const breadcrumb = [
    {
      label: 'Home',
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
    },
    { label: 'Settings' }
  ];

  if (!sectionIsValid) {
    if (ctx.defaultSettingsSection) return null;

    return (
      <div className={styles.screen}>
        <div className={styles.head}>
          <Title
            breadcrumb={breadcrumb}
            title="Workspace settings"
            description="No settings are available for your current permissions."
          />
        </div>
      </div>
    );
  }

  const sectionButton =
    section === 'members' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setMembersAddDialogOpen(true)}
      >
        Add user
      </Button>
    ) : section === 'teams' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setTeamsAddDialogOpen(true)}
      >
        Add team
      </Button>
    ) : section === 'roles' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setRolesAddDialogOpen(true)}
      >
        New custom role
      </Button>
    ) : undefined;

  return (
    <div className={styles.screen}>
      <div className={styles.head}>
        <Title
          breadcrumb={breadcrumb}
          title={meta.title}
          description={meta.sub}
          buttons={sectionButton}
        />
      </div>

      {section === 'general' && <GeneralSubSection workspace={workspace} />}
      {section === 'lifecycle-owners' && (
        <LifecycleSubSection workspace={workspace} lifecycleStates={lifecycleStates} />
      )}
      {section === 'roles' && (
        <RolesPermissionsSubSection
          workspaceSlug={workspaceSlug}
          createDialogOpen={rolesAddDialogOpen}
          onCloseCreateDialog={() => setRolesAddDialogOpen(false)}
        />
      )}
      {section === 'teams' && (
        <TeamsSubSection
          workspaceSlug={workspaceSlug}
          addDialogOpen={teamsAddDialogOpen}
          onCloseAddDialog={() => setTeamsAddDialogOpen(false)}
        />
      )}
      {section === 'members' && (
        <MembersSubSection
          workspaceSlug={workspaceSlug}
          addDialogOpen={membersAddDialogOpen}
          onCloseAddDialog={() => setMembersAddDialogOpen(false)}
        />
      )}
      {section === 'ai' && <AiSettingsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'export-import' && <ExportImportSubSection />}
      {section === 'analytics' && (
        <Suspense fallback={<RoutePendingComponent />}>
          <WorkspaceAnalyticsScreen analyticsView={search.analyticsView} />
        </Suspense>
      )}
      {section === 'audit' && (
        <AuditLogSubSection
          key={`${search.auditEntityType ?? ''}:${search.auditOperation ?? ''}:${search.auditStartDate ?? ''}:${search.auditEndDate ?? ''}`}
          workspace={workspace}
          workspaceSlug={workspaceSlug}
          initialFilters={{
            entityType: search.auditEntityType,
            operation: search.auditOperation,
            startDate: search.auditStartDate,
            endDate: search.auditEndDate
          }}
        />
      )}
      {section === 'jobs' && <JobMonitoringSubSection workspaceSlug={workspaceSlug} />}
      {section === 'webhooks' && (
        <WebhooksSubSection workspaceSlug={workspaceSlug} schemas={ctx.schemas} />
      )}
      {section === 'danger' && <DangerZoneSubSection workspace={workspace} />}
    </div>
  );
};
