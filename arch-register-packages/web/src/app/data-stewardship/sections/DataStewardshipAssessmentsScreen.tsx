import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { Title } from '../../../components/Title';
import { SearchInput } from '../../../components/SearchInput';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { projectsQuery } from '../../../queries/projects';
import { dueLabel, dueTone } from '../../../utils/assessmentDueTone';
import { resolveDataStewardshipConfig } from '../dataStewardshipQueries';
import { DS_ASSESSMENTS_ID, DS_MY_WORK_ID, DS_RAIL_PATHS } from '../dataStewardshipSections';
import {
  ENTITY_ASSESSMENT_STATUS_LABEL,
  type EntityAssessmentStatus,
  type EntityAssessmentSummary
} from '../../../sections/entities/entityDrawer/entityAssessments';
import { useEntityAssessmentRows } from '../../../sections/entities/entityDrawer/useEntityAssessmentRows';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import type { DataStewardshipAssessmentsSearchParams } from '../../../routes/searchParams';
import filterStyles from '../../../sections/entities/components/EntityBrowser.module.css';
import styles from './DataStewardshipStewardshipScreen.module.css';

/** Status-pill/dot colours — mirrors the design reference's `DS_AT_TONE`
 *  (`ds-data.jsx`: Overdue/In progress/Not started/Complete). */
const STATUS_TONE: Record<EntityAssessmentStatus, string> = {
  overdue: 'var(--cmp-fg-danger, #ef4444)',
  in_progress: 'var(--cmp-fg-warning, #eab308)',
  not_started: 'var(--cmp-fg-dim, #9ca3af)',
  complete: 'var(--cmp-fg-success, #22c55e)'
};

/**
 * The Assessments section: impact assessments, transfer assessments, records surveys and
 * data-quality runs bound to datasets — a read view over the existing, generic assessment
 * machinery (the same `Assessment`/`AssessmentResponse` model Projects and Risk & Compliance's own
 * `../../risk-compliance/sections/RiskComplianceAssessmentsScreen.tsx` already use), scoped down to
 * whichever assessments target the workspace's Data Entity schema (`assessment.scope`), same
 * `scopedTo` shape RC's screen uses with only one bound schema instead of two.
 *
 * One row per assessment (`deriveEntityAssessmentSummaries`), not per dataset — an earlier
 * version joined every assessment against every dataset entity it targets, matching the Claude
 * Design reference's `DSAssessments` mock (`ds-views.jsx`), where each mock assessment record is
 * already bound to exactly one dataset. That join reads as a confusing, arbitrarily-repeated
 * "progress" per row once a real assessment spans several datasets — one row, one aggregate
 * progress bar (in-scope datasets with a complete response, over the total in scope) reads far more
 * clearly, and mirrors RC's own one-row-per-assessment register. The per-dataset join still backs
 * the shared entity drawer's Assessments section, where "this entity's status on this assessment"
 * is exactly what's wanted.
 *
 * The Assessment column's subtitle is the assessment's own `description` — the closest analog to
 * the design reference's per-assessment `note` line under the name.
 *
 * The design's "Findings" stat/column has no analog anywhere on the shipped model (confirmed by a
 * full-repo search — the same gap `RiskComplianceAssessmentsScreen.tsx` already documents for
 * "Kind/Owner/Findings/Opened"), so it's dropped; the stat strip promotes "Not started" to its own
 * tile in its place, keeping a genuine 4-way partition of every row instead of a 3-tile strip with
 * an invented fourth number. "Dataset"/"Owner" have no analog either once a row is a whole
 * assessment rather than one dataset, so like RC's own screen they're dropped too — replaced with a
 * Project column (`assessment.project_id` resolved against `projectsQuery`), since a row links out
 * to its owning Project (assessments are authored/filled there, not in this app).
 *
 * The status facet lives in this section's own primary sidebar (`DataStewardshipSidebar.tsx`'s
 * `AssessmentsSidebarContent` — All/Overdue/In progress/Not started/Complete, mirroring the stat
 * strip's own buckets), same as Stewardship's and Classification's own facet sidebars; only free-text
 * search stays in this screen's toolbar.
 */
export const DataStewardshipAssessmentsScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as DataStewardshipAssessmentsSearchParams;
  const q = search.q ?? '';

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const dataStewardshipConfig = resolveDataStewardshipConfig(configurations.data);

  const { summaries, isLoading: loading } = useEntityAssessmentRows(
    workspaceSlug,
    dataStewardshipConfig?.dataEntitySchemaId ?? null,
    dataStewardshipConfig != null
  );
  const projects = useQuery(projectsQuery(workspaceSlug));

  const projectsById = useMemo(() => {
    const map = new Map<string, { publicId: string; name: string }>();
    (projects.data ?? []).forEach(project =>
      map.set(project.id, { publicId: project.public_id, name: project.name })
    );
    return map;
  }, [projects.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return summaries
      .filter(summary => !search.status || summary.status === search.status)
      .filter(summary => {
        if (!needle) return true;
        const projectName = projectsById.get(summary.assessment.project_id)?.name ?? '';
        return `${summary.assessment.name} ${summary.kind} ${projectName}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
  }, [summaries, q, search.status, projectsById]);

  const overdue = summaries.filter(summary => summary.status === 'overdue');
  const inProgress = summaries.filter(summary => summary.status === 'in_progress');
  const notStarted = summaries.filter(summary => summary.status === 'not_started');
  const complete = summaries.filter(summary => summary.status === 'complete');

  const patchSearch = (patch: Partial<DataStewardshipAssessmentsSearchParams>) =>
    navigate({
      to: DS_RAIL_PATHS[DS_ASSESSMENTS_ID],
      params: { workspaceSlug },
      search: (previous: Record<string, unknown>) => ({ ...previous, ...patch })
    });

  const openAssessment = (summary: EntityAssessmentSummary) => {
    const project = projectsById.get(summary.assessment.project_id);
    if (!project) return;
    navigate(
      projectDetailRoute(workspaceSlug, asProjectPublicId(project.publicId), {
        section: 'assessments' as const,
        assessmentId: summary.assessment.id
      })
    );
  };

  if (configurations.isLoading) {
    return <div className={styles.empty}>Loading data stewardship…</div>;
  }
  if (!dataStewardshipConfig) {
    return (
      <div className={styles.empty}>
        Data stewardship is not enabled. Configure the data stewardship capability in workspace
        settings.
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <Title
        title="Assessments"
        chips={!loading && <span>{filtered.length}</span>}
        description="Impact assessments, transfer assessments, records surveys and data-quality runs. Same questionnaire machinery the rest of the register uses, bound here to datasets."
        buttons={
          <Button
            variant="secondary"
            onClick={() =>
              navigate({ to: DS_RAIL_PATHS[DS_MY_WORK_ID], params: { workspaceSlug } })
            }
          >
            Sign-offs due
          </Button>
        }
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Overdue</div>
          <div
            className={styles.tileValue}
            style={overdue.length ? { color: STATUS_TONE.overdue } : undefined}
          >
            {overdue.length}
          </div>
          <div className={styles.tileSub}>past the scheduled date</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>In progress</div>
          <div
            className={styles.tileValue}
            style={inProgress.length ? { color: STATUS_TONE.in_progress } : undefined}
          >
            {inProgress.length}
          </div>
          <div className={styles.tileSub}>{notStarted.length} not started</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Not started</div>
          <div className={styles.tileValue}>{notStarted.length}</div>
          <div className={styles.tileSub}>no response recorded yet</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Complete</div>
          <div className={styles.tileValue}>{complete.length}</div>
          <div className={styles.tileSub}>of {summaries.length} assessments</div>
        </div>
      </div>

      <div className={filterStyles.toolbar}>
        <SearchInput
          size="sm"
          className={filterStyles.searchInline}
          value={q}
          placeholder="Search assessments by name, kind, or project…"
          aria-label="Search assessments"
          onChange={value => patchSearch({ q: value || undefined })}
          onClear={() => patchSearch({ q: undefined })}
        />
      </div>

      <Table.Root scroll stickyHeader>
        <Table.Head>
          <Table.Row>
            <Table.HeaderCell>Assessment</Table.HeaderCell>
            <Table.HeaderCell>Kind</Table.HeaderCell>
            <Table.HeaderCell>Project</Table.HeaderCell>
            <Table.HeaderCell>Progress</Table.HeaderCell>
            <Table.HeaderCell align="right">Questions</Table.HeaderCell>
            <Table.HeaderCell align="right">Due</Table.HeaderCell>
            <Table.HeaderCell>Status</Table.HeaderCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          {loading ? (
            <Table.EmptyRow colSpan={7}>Loading assessments…</Table.EmptyRow>
          ) : filtered.length === 0 ? (
            <Table.EmptyRow colSpan={7}>No assessments match these filters.</Table.EmptyRow>
          ) : (
            filtered.map(summary => (
              <Table.Row key={summary.assessment.id} onClick={() => openAssessment(summary)}>
                <Table.NameCell
                  title={summary.assessment.name}
                  subtitle={summary.assessment.description || undefined}
                />
                <Table.Cell className="dim">{summary.kind}</Table.Cell>
                <Table.Cell className="dim">
                  {projectsById.get(summary.assessment.project_id)?.name ?? '—'}
                </Table.Cell>
                <Table.Cell>
                  <span className={styles.progress}>
                    <span className={styles.progressTrack}>
                      <span
                        className={styles.progressFill}
                        style={{
                          width: `${Math.round(summary.percent * 100)}%`,
                          background: summary.status === 'overdue' ? STATUS_TONE.overdue : undefined
                        }}
                      />
                    </span>
                    <span className="dim mono">{Math.round(summary.percent * 100)}%</span>
                  </span>
                </Table.Cell>
                <Table.Cell numeric className="dim mono">
                  {summary.questions}
                </Table.Cell>
                <Table.Cell numeric style={{ color: dueTone(summary.due) }}>
                  {dueLabel(summary.due)}
                </Table.Cell>
                <Table.Cell>
                  <Chip tone="ghost" color={STATUS_TONE[summary.status]}>
                    {ENTITY_ASSESSMENT_STATUS_LABEL[summary.status]}
                  </Chip>
                </Table.Cell>
              </Table.Row>
            ))
          )}
        </Table.Body>
      </Table.Root>
    </div>
  );
};
