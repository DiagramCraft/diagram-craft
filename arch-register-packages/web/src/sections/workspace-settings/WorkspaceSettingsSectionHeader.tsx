import { getRouteApi } from '@tanstack/react-router';
import { Title } from '../../components/Title';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import styles from './WorkspaceSettingsSectionHeader.module.css';

export const SECTION_META: Record<string, { title: string; sub: string }> = {
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
  'query-console': {
    title: 'Query Console',
    sub: 'Run ad-hoc entity queries and inspect the raw records returned by the catalog.'
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

export const WorkspaceSettingsSectionHeader = ({
  section,
  actionsRef
}: {
  section: string;
  /** Receives the element that `SectionActions` portals sub-section buttons into. */
  actionsRef?: (element: HTMLElement | null) => void;
}) => {
  const navigate = routeApi.useNavigate();
  const { workspaceSlug } = useWorkspaceContext();
  const meta = SECTION_META[section] ?? SECTION_META['general']!;

  return (
    <div className={styles.head}>
      <Title
        breadcrumb={[
          {
            label: 'Home',
            onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
          },
          { label: 'Settings' }
        ]}
        title={meta.title}
        description={meta.sub}
        buttons={<div ref={actionsRef} className={styles.actions} />}
      />
    </div>
  );
};
