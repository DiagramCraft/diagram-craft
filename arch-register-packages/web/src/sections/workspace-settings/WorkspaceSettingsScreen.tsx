import { lazy, Suspense, useEffect } from 'react';
import styles from './WorkspaceSettingsScreen.module.css';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Title } from '../../components/Title';
import { WorkspaceSettingsSectionHeader } from './WorkspaceSettingsSectionHeader';
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
import { WorkspaceApiTokensSubSection } from './sub-sections/WorkspaceApiTokensSubSection';
import { AssessmentTypesSubSection } from './sub-sections/AssessmentTypesSubSection';
import { PublicCatalogSubSection } from './sub-sections/PublicCatalogSubSection';
import { ConformanceSubSection } from './sub-sections/ConformanceSubSection';
import { QueryConsoleSubSection } from './sub-sections/QueryConsoleSubSection';

const WorkspaceAnalyticsScreen = lazy(() =>
  import('./sub-sections/analytics/WorkspaceAnalyticsScreen').then(module => ({
    default: module.WorkspaceAnalyticsScreen
  }))
);

// Sections that render their own header because it carries section-specific actions
const SELF_HEADED_SECTIONS = [
  'general',
  'currencies',
  'assessment-types',
  'members',
  'teams',
  'roles',
  'jobs',
  'api-tokens',
  'workflows',
  'conformance'
];

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

  useEffect(() => {
    if (sectionIsValid || !ctx.defaultSettingsSection) return;
    navigate({
      to: '/$workspaceSlug/settings/$section',
      params: { workspaceSlug, section: ctx.defaultSettingsSection },
      replace: true
    });
  }, [sectionIsValid, ctx.defaultSettingsSection, navigate, workspaceSlug]);

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

  const selfHeaded = SELF_HEADED_SECTIONS.includes(section);

  return (
    <div className={styles.screen}>
      {!selfHeaded && <WorkspaceSettingsSectionHeader section={section} />}

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
      {section === 'roles' && <RolesPermissionsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'teams' && <TeamsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'members' && <MembersSubSection workspaceSlug={workspaceSlug} />}
      {section === 'api-tokens' && <WorkspaceApiTokensSubSection workspaceSlug={workspaceSlug} />}
      {section === 'ai' && <AiSettingsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'workflows' && <WorkflowsSubSection workspaceSlug={workspaceSlug} />}
      {section === 'export-import' && <ExportImportSubSection />}
      {section === 'query-console' && <QueryConsoleSubSection workspaceId={workspaceSlug} />}
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
