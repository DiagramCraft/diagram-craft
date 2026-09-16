import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { assessmentsQuery } from '../../../queries/assessments';
import { projectsQuery } from '../../../queries/projects';
import { useSchemas } from '../../../hooks/useSchemas';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { resolveRiskComplianceConfig } from '../riskComplianceQueries';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { AssessmentsSearchParams } from '../../../routes/searchParams';
import { RISK_RAIL_PATHS, RISK_ASSESSMENTS_ID } from '../riskComplianceSections';
import { AssessmentDuePanel, type AssessmentDuePanelProject } from './AssessmentDuePanel';
import { dueLabel, dueTone } from './assessmentDueTone';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './RiskComplianceAssessmentsScreen.module.css';

const scopedTo = (assessments: Assessment[], schemaId: string | null): Assessment[] =>
  schemaId ? assessments.filter(assessment => assessment.scope.includes(schemaId)) : [];

const STATUS_LABEL: Record<Assessment['status'], string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  archived: 'Archived'
};

/** Colour for the register's status pill — mirrors the design reference's `RC_AT_TONE`
 *  (`rc-data.jsx`: Overdue/In progress/Not started/Complete), adapted to this shipped model's
 *  actual `draft`/`open`/`closed`/`archived` statuses: an open, past-due assessment reads as the
 *  design's "Overdue", any other open one as its "In progress". */
const statusColor = (assessment: Assessment): string => {
  if (assessment.status === 'closed') return 'var(--cmp-fg-success, #22c55e)';
  if (assessment.status === 'open') {
    const overdue = assessment.due_at !== null && assessment.due_at < new Date().toISOString();
    return overdue ? 'var(--cmp-fg-danger, #ef4444)' : 'var(--cmp-fg-warning, #eab308)';
  }
  return 'var(--cmp-fg-dim, #9ca3af)';
};

/** One register row's Scope/Progress cells — kept as their own component so the per-row
 *  `useEntitiesBySchema` in-scope-entity count (needed for the progress bar, same computation as
 *  `AssessmentCard` in `../../../sections/projects/components/AssessmentList.tsx`) is one hook call
 *  per row rather than one per screen render. */
const AssessmentRow = ({
  workspaceSlug,
  assessment,
  schemas,
  onOpen
}: {
  workspaceSlug: string;
  assessment: Assessment;
  schemas: EntitySchema[];
  onOpen: () => void;
}) => {
  const scopeQueries = useEntitiesBySchema(
    workspaceSlug,
    assessment.scope,
    assessment.scope_conditions
  );
  const inScopeCount = scopeQueries.reduce((sum, query) => sum + (query.data?.length ?? 0), 0);
  const pct =
    inScopeCount > 0 ? Math.round((assessment.completed_entity_count / inScopeCount) * 100) : null;
  const scopeNames = assessment.scope
    .map(id => schemas.find(schema => schema.id === id)?.name)
    .filter((name): name is string => !!name);

  return (
    <Table.Row onClick={onOpen}>
      <Table.NameCell title={assessment.name} />
      <Table.Cell className="dim">{scopeNames.join(', ') || '—'}</Table.Cell>
      <Table.Cell>
        {pct === null ? (
          <span className="dim">—</span>
        ) : (
          <span className={styles.progress}>
            <span className={styles.progressTrack}>
              <span className={styles.progressFill} style={{ width: `${pct}%` }} />
            </span>
            <span className="dim mono">
              {assessment.completed_entity_count}/{inScopeCount}
            </span>
          </span>
        )}
      </Table.Cell>
      <Table.Cell numeric style={{ color: dueTone(assessment.due_at) }}>
        {dueLabel(assessment.due_at)}
      </Table.Cell>
      <Table.Cell>
        <Chip tone="ghost" color={statusColor(assessment)}>
          {STATUS_LABEL[assessment.status]}
        </Chip>
      </Table.Cell>
    </Table.Row>
  );
};

/**
 * A read view over the existing, generic assessment machinery (the same `Assessment` model used
 * by Projects and by Strategy/Vendor Management's own periodic reviews — no new case kind, per
 * #3284's scope), scoped down to whichever assessments target the workspace's Risk and/or Control
 * schema (`assessment.scope`). Mirrors the design reference's `RCAssessments` (`rc-views.jsx`): a
 * dense register table (Name, Scope, Progress, Due, Status — "Kind"/"Owner"/"Findings"/"Opened"
 * have no analog on the shipped `Assessment` model, so they're dropped rather than invented, same
 * "closest existing field" approach `RiskComplianceRisksScreen.tsx` took for "next review") plus
 * two "due soon" panels below the header.
 *
 * Assessments aren't owned by this app — each belongs to a Project — so authoring/filling one in
 * stays on the Projects side (`EntityAssessmentsTab.tsx`'s "View in Assessments" link uses the
 * same pattern); this screen is read-only and links out via `projectDetailRoute` rather than
 * adding an in-app editor or detail drawer.
 */
export const RiskComplianceAssessmentsScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as AssessmentsSearchParams;
  const q = search.q ?? '';
  const type = search.type;
  const [statusFilter, setStatusFilter] = useState<'default' | 'draft' | 'archived' | 'all'>(
    'default'
  );

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const projects = useQuery(projectsQuery(workspaceSlug));
  const allAssessments = useQuery(assessmentsQuery(workspaceSlug, riskConfig != null));

  const projectsById = useMemo(() => {
    const map = new Map<string, AssessmentDuePanelProject>();
    (projects.data ?? []).forEach(project =>
      map.set(project.id, { publicId: project.public_id, name: project.name })
    );
    return map;
  }, [projects.data]);

  const riskAssessments = useMemo(
    () => scopedTo(allAssessments.data ?? [], riskConfig?.riskSchemaId ?? null),
    [allAssessments.data, riskConfig?.riskSchemaId]
  );
  const controlAssessments = useMemo(
    () => scopedTo(allAssessments.data ?? [], riskConfig?.controlSchemaId ?? null),
    [allAssessments.data, riskConfig?.controlSchemaId]
  );
  const scopedAssessments = useMemo(() => {
    if (type === 'risk') return riskAssessments;
    if (type === 'control') return controlAssessments;
    const byId = new Map<string, Assessment>();
    [...riskAssessments, ...controlAssessments].forEach(assessment =>
      byId.set(assessment.id, assessment)
    );
    return [...byId.values()];
  }, [type, riskAssessments, controlAssessments]);

  const statusFiltered = useMemo(
    () =>
      scopedAssessments.filter(assessment => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'default') {
          return assessment.status === 'open' || assessment.status === 'closed';
        }
        return assessment.status === statusFilter;
      }),
    [scopedAssessments, statusFilter]
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return statusFiltered;
    return statusFiltered.filter(assessment => assessment.name.toLowerCase().includes(needle));
  }, [statusFiltered, q]);

  const patchSearch = (patch: Partial<AssessmentsSearchParams>) =>
    navigate({
      to: RISK_RAIL_PATHS[RISK_ASSESSMENTS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openAssessment = (assessmentId: string) => {
    const assessment = scopedAssessments.find(candidate => candidate.id === assessmentId);
    const project = assessment && projectsById.get(assessment.project_id);
    if (!project) return;
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(project.publicId), {
        section: 'assessments' as const,
        assessmentId
      })
    );
  };

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading risk & compliance…</div>;
  }
  if (!riskConfig) {
    return (
      <div className={styles.empty}>
        Risk & Compliance is not enabled. Configure the risk-compliance capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Assessments"
        chips={!allAssessments.isLoading && <span>{filtered.length}</span>}
        description="Periodic risk reviews and control tests, run on the workspace assessment machinery. Responses become the evidence held against each record."
      />

      <div className={styles.panels}>
        <AssessmentDuePanel
          title="Risk reviews due"
          assessments={riskAssessments}
          projectsById={projectsById}
          onOpenAssessment={openAssessment}
        />
        {riskConfig.controlSchemaId && (
          <AssessmentDuePanel
            title="Control tests due"
            assessments={controlAssessments}
            projectsById={projectsById}
            onOpenAssessment={openAssessment}
          />
        )}
      </div>

      <div className={filterStyles.toolbar}>
        <ToggleButtonGroup.Root
          type="single"
          aria-label="Assessment scope"
          value={type ?? 'all'}
          onChange={value => {
            if (value) {
              patchSearch({ type: value === 'all' ? undefined : (value as 'risk' | 'control') });
            }
          }}
        >
          <ToggleButtonGroup.Item value="all">All</ToggleButtonGroup.Item>
          <ToggleButtonGroup.Item value="risk">Risk</ToggleButtonGroup.Item>
          {riskConfig.controlSchemaId && (
            <ToggleButtonGroup.Item value="control">Control</ToggleButtonGroup.Item>
          )}
        </ToggleButtonGroup.Root>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search assessments by name…"
          aria-label="Search assessments"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
        <div style={{ marginLeft: 'auto' }}>
          <ToggleButtonGroup.Root
            type="single"
            aria-label="Assessment status"
            value={statusFilter}
            onChange={value => {
              if (value) setStatusFilter(value as typeof statusFilter);
            }}
          >
            <ToggleButtonGroup.Item value="default">Open / Closed</ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value="draft">Draft</ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value="archived">Archived</ToggleButtonGroup.Item>
            <ToggleButtonGroup.Item value="all">All</ToggleButtonGroup.Item>
          </ToggleButtonGroup.Root>
        </div>
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Assessment</Table.HeaderCell>
            <Table.HeaderCell>Scope</Table.HeaderCell>
            <Table.HeaderCell>Progress</Table.HeaderCell>
            <Table.HeaderCell align="right">Due</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {allAssessments.isLoading ? (
            <Table.EmptyRow colSpan={5}>Loading assessments…</Table.EmptyRow>
          ) : filtered.length === 0 ? (
            <Table.EmptyRow colSpan={5}>No assessments match these filters.</Table.EmptyRow>
          ) : (
            filtered.map(assessment => (
              <AssessmentRow
                key={assessment.id}
                workspaceSlug={workspaceSlug}
                assessment={assessment}
                schemas={schemas.data ?? []}
                onOpen={() => openAssessment(assessment.id)}
              />
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
