import { lazy, Suspense, useState, useEffect, type ReactNode } from 'react';
import styles from './WorkspaceSettingsScreen.module.css';
import { Button } from '@diagram-craft/app-components/Button';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { TbPlus } from 'react-icons/tb';
import { Title } from '../../components/Title';
import { GeneralSubSection } from './sub-sections/GeneralSubSection';
import { LifecycleSubSection } from './sub-sections/LifecycleSubSection';
import { SupportedCurrenciesSubSection } from './sub-sections/SupportedCurrenciesSubSection';
import { AuditLogSubSection } from './sub-sections/AuditLogSubSection';
import { DangerZoneSubSection } from './sub-sections/DangerZoneSubSection';
import { RolesPermissionsSubSection } from './sub-sections/RolesPermissionsSubSection';
import { MembersSubSection } from './sub-sections/MembersSubSection';
import { TeamsSubSection } from './sub-sections/TeamsSubSection';
import { AiSettingsSubSection } from './sub-sections/AiSettingsSubSection';
import { WorkflowsSubSection } from './sub-sections/WorkflowsSubSection';
import { ExportImportSubSection } from './sub-sections/ExportImportSubSection';
import { RoutePendingComponent } from '../../routes/RoutePendingComponent';
import { JobMonitoringSubSection } from './sub-sections/JobMonitoringSubSection';
import { WebhooksSubSection } from './sub-sections/WebhooksSubSection';
import { AutomationRulesSubSection } from './sub-sections/AutomationRulesSubSection';
import { CreateJobDialog } from '../../components/jobs/CreateJobDialog';
import { WorkspaceApiTokensSubSection } from './sub-sections/WorkspaceApiTokensSubSection';
import { AssessmentTypesSubSection } from './sub-sections/AssessmentTypesSubSection';
import { PublicCatalogSubSection } from './sub-sections/PublicCatalogSubSection';
import { WorkspaceCapabilitiesSubSection } from './sub-sections/WorkspaceCapabilitiesSubSection';
import { ConformanceSubSection } from './sub-sections/ConformanceSubSection';

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
  'currencies': {
    title: 'Currencies',
    sub: 'Configure the supported currencies and default currency for this workspace.'
  },
  'assessment-types': {
    title: 'Assessment types',
    sub: 'Configure categories used to organize workspace assessments and dashboard views.'
  },
  'capabilities': {
    title: 'Capability Binding',
    sub: 'Bind capability roles to the schemas and fields used by this workspace.'
  },
  'model-overview': {
    title: 'Model Overview',
    sub: 'Visualize relationships between entity and relation types in your data model.'
  },
  'schemas': {
    title: 'Schemas',
    sub: 'Define entity types, fields, and enums that structure your workspace data.'
  },
  'roles': {
    title: 'Roles & permissions',
    sub: 'Manage built-in roles and create custom workspace roles.'
  },
  'api-tokens': {
    title: 'API Tokens',
    sub: 'Manage API tokens owned by this workspace, independent of any individual member.'
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
  'workflows': {
    title: 'Workflows',
    sub: 'Configure approvals, reminders, escalation, and case-specific governance workflows.'
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
    sub: 'Configure recurring jobs, inspect their runs, and cancel queued work.'
  },
  'webhooks': {
    title: 'Webhooks',
    sub: 'Notify external systems when catalog entities change.'
  },
  'automation': {
    title: 'Automation rules',
    sub: 'Automatically take action when entities match a trigger and conditions.'
  },
  'danger': {
    title: 'Danger zone',
    sub: "Operations that can't be undone. Read carefully before clicking."
  },
  'public-catalog': {
    title: 'Public catalog',
    sub: 'Configure the read-only entities, wiki pages, and API specifications exposed to external consumers.'
  },
  'conformance': {
    title: 'Conformance',
    sub: 'Manage scheduled validations, query policies, AI checks, and their persistent violations.'
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
  const [workflowAddDialogOpen, setWorkflowAddDialogOpen] = useState(false);
  const [jobAddDialogOpen, setJobAddDialogOpen] = useState(false);
  const [apiTokenAddDialogOpen, setApiTokenAddDialogOpen] = useState(false);
  const [capabilityActions, setCapabilityActions] = useState<ReactNode>();

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
    section === 'capabilities' ? (
      capabilityActions
    ) : section === 'members' ? (
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
    ) : section === 'jobs' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setJobAddDialogOpen(true)}
      >
        Add job
      </Button>
    ) : section === 'api-tokens' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setApiTokenAddDialogOpen(true)}
      >
        Create token
      </Button>
    ) : section === 'workflows' ? (
      <Button
        variant="primary"
        icon={<TbPlus size={12} />}
        onClick={() => setWorkflowAddDialogOpen(true)}
      >
        Add configuration
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
      {section === 'currencies' && (
        <SupportedCurrenciesSubSection
          workspaceId={workspace.id}
          currencies={ctx.currencies.currencies}
          defaultCurrency={ctx.currencies.default_currency}
        />
      )}
      {section === 'assessment-types' && (
        <AssessmentTypesSubSection
          workspaceId={workspace.id}
          assessmentTypes={ctx.assessmentTypes}
        />
      )}
      {section === 'capabilities' && (
        <WorkspaceCapabilitiesSubSection
          workspaceSlug={workspaceSlug}
          schemas={ctx.schemas}
          onActionsChange={setCapabilityActions}
        />
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
      {section === 'api-tokens' && (
        <WorkspaceApiTokensSubSection
          workspaceSlug={workspaceSlug}
          createDialogOpen={apiTokenAddDialogOpen}
          onCloseCreateDialog={() => setApiTokenAddDialogOpen(false)}
        />
      )}
      {section === 'ai' && <AiSettingsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'workflows' && (
        <WorkflowsSubSection
          workspaceSlug={workspaceSlug}
          addDialogOpen={workflowAddDialogOpen}
          onCloseAddDialog={() => setWorkflowAddDialogOpen(false)}
        />
      )}
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
      {section === 'conformance' && (
        <ConformanceSubSection workspaceSlug={workspaceSlug} schemas={ctx.schemas} />
      )}
      {section === 'jobs' && (
        <CreateJobDialog
          open={jobAddDialogOpen}
          workspaceSlug={workspaceSlug}
          onClose={() => setJobAddDialogOpen(false)}
        />
      )}
      {section === 'webhooks' && (
        <WebhooksSubSection workspaceSlug={workspaceSlug} schemas={ctx.schemas} />
      )}
      {section === 'automation' && (
        <AutomationRulesSubSection
          workspaceSlug={workspaceSlug}
          schemas={ctx.schemas}
          lifecycleStates={lifecycleStates}
        />
      )}
      {section === 'danger' && <DangerZoneSubSection workspace={workspace} />}
      {section === 'public-catalog' && (
        <PublicCatalogSubSection workspaceSlug={workspaceSlug} schemas={ctx.schemas} />
      )}
    </div>
  );
};
