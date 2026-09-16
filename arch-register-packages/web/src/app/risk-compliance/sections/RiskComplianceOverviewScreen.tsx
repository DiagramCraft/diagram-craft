import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import { ToggleButtonGroup } from '@diagram-craft/app-components/ToggleButtonGroup';
import { Title } from '../../../components/Title';
import { Chip } from '../../../components/Chip';
import { Table } from '../../../components/table/Table';
import { entitiesQuery } from '../../../queries/entities';
import { workspaceCapabilityConfigurationsQuery } from '../../../queries/workspaceConfig';
import { assessmentsQuery } from '../../../queries/assessments';
import { projectsQuery } from '../../../queries/projects';
import { useSchemas } from '../../../hooks/useSchemas';
import {
  resolveRiskComplianceConfig,
  resolveRetentionConfig,
  resolveRetentionFieldIds
} from '../riskComplianceQueries';
import {
  RISK_RAIL_PATHS,
  RISK_RISKS_ID,
  RISK_CONTROLS_ID,
  RISK_RETENTION_ID,
  RISK_ASSESSMENTS_ID
} from '../riskComplianceSections';
import { useRiskCoverageRollups } from '../useRiskCoverageRollups';
import { residualRiskBand, RESIDUAL_RISK_BAND_COLOR } from '../residualRiskBand';
import { COVERAGE_BAND_COLOR } from '../riskCoverage';
import { riskFieldValue } from '../riskFieldDisplay';
import { useRetentionAssignments } from '../useRetentionAssignments';
import { asProjectPublicId, projectDetailRoute } from '../../../routes/publicObjectRoutes';
import { RiskComplianceMatrix, type RiskComplianceMatrixRisk } from './RiskComplianceMatrix';
import { RiskDrawer } from './RiskDrawer';
import { AssessmentDuePanel, type AssessmentDuePanelProject } from './AssessmentDuePanel';
import tileStyles from './RiskComplianceControlsScreen.module.css';
import styles from './RiskComplianceOverviewScreen.module.css';

const HIGHEST_RISKS_LIMIT = 6;
const WEAK_COVERAGE_LIMIT = 8;
const RETENTION_GAPS_LIMIT = 6;
const DUE_SOON_DAYS = 30;

const compareNullable = (a: number | null, b: number | null): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
};

const daysUntil = (iso: string, today: Date = new Date()): number => {
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const due = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Math.round((due.getTime() - todayMidnight.getTime()) / 86_400_000);
};

/** Mirrors `RiskComplianceAssessmentsScreen.tsx`'s local `scopedTo` — kept as its own tiny copy
 *  here rather than exported, since these are the only two callers. */
const scopedTo = (assessments: Assessment[], schemaId: string | null): Assessment[] =>
  schemaId ? assessments.filter(assessment => assessment.scope.includes(schemaId)) : [];

const dedupeById = (assessments: Assessment[]): Assessment[] => {
  const byId = new Map<string, Assessment>();
  assessments.forEach(assessment => byId.set(assessment.id, assessment));
  return [...byId.values()];
};

/** Banded green/amber/red bar colour by ratio — mirrors `../../strategy-model/sections/
 *  CapabilityMaturityBar.tsx`'s `heatColor`, applied to an effective/total ratio instead of a
 *  1-5 maturity score. */
const ratioColor = (effective: number, total: number): string => {
  if (total === 0) return 'var(--base-fg-more-dim)';
  const ratio = effective / total;
  if (ratio >= 1) return 'var(--cmp-fg-success, #22c55e)';
  if (ratio >= 0.5) return 'var(--cmp-fg-warning, #eab308)';
  return 'var(--cmp-fg-danger, #ef4444)';
};

/**
 * The Risk & Compliance app's landing screen (`sections[0]`, so the app switcher opens here) — a
 * read-only dashboard summarizing the other four sections, each panel linking into the section
 * that owns the full view. Mirrors the Claude Design reference's `RCOverview` (`rc.jsx`) and this
 * codebase's own `../../vendor-management/sections/VendorOverviewScreen.tsx` (Vendor Management's
 * own overview). Everything here is a client-side roll-up over the same entity/relation/assessment
 * queries and hooks the Risks/Controls/Retention/Assessments sections already use — no bespoke
 * server endpoint and no new hooks.
 *
 * Two of the design reference's stats don't survive the shipped schema and are substituted rather
 * than dropped or faked: "records past disposal" / a retention expiry summary need a per-record
 * disposal due date, but `retention-assignment` links a policy to a Data Entity *category*, not an
 * individual record — exactly why `RiskComplianceRetentionScreen.tsx` itself dropped its own
 * Overdue/Next-30-days dashboard (see that file's doc comment). This screen instead reports
 * retention *completeness* — assignments missing a required field — which the data can actually
 * support. "Coverage by family" groups by `control_type` (Controls has no dedicated family field,
 * per #3279's "adapt to the shipped schema" precedent), and "due in 30 days"/"upcoming reviews" use
 * the generic Assessment model's `due_at`, since Controls has no per-control next-test date either.
 */
export const RiskComplianceOverviewScreen = () => {
  const { workspaceSlug } = useParams({ strict: false }) as { workspaceSlug: string };
  const navigate = useNavigate();
  const [openRiskId, setOpenRiskId] = useState<string | null>(null);
  const [matrixAxis, setMatrixAxis] = useState<'inherent' | 'residual'>('residual');

  const configurations = useQuery(workspaceCapabilityConfigurationsQuery(workspaceSlug));
  const riskConfig = resolveRiskComplianceConfig(configurations.data);
  const retentionConfig = resolveRetentionConfig(configurations.data);
  const retentionFieldIds = resolveRetentionFieldIds(configurations.data);
  const schemas = useSchemas(workspaceSlug);
  const riskSchema = schemas.data?.find(schema => schema.id === riskConfig?.riskSchemaId);
  const controlSchema = schemas.data?.find(schema => schema.id === riskConfig?.controlSchemaId);

  const mitigatingControlsField = riskSchema?.fields.find(
    field => field.id === 'mitigating_controls'
  );
  const riskControlRelationSchemaId =
    mitigatingControlsField?.type === 'typedRelation'
      ? mitigatingControlsField.relationSchemaId
      : null;

  const risks = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.riskSchemaId, view: 'full', limit: 500 },
      riskConfig != null
    )
  );
  const liveRisks = useMemo(
    () => (risks.data?.items ?? []).filter(entity => entity.status !== 'closed'),
    [risks.data]
  );
  const coverage = useRiskCoverageRollups(workspaceSlug, riskControlRelationSchemaId);

  const controls = useQuery(
    entitiesQuery(
      workspaceSlug,
      { schemaId: riskConfig?.controlSchemaId ?? undefined, view: 'full', limit: 500 },
      riskConfig?.controlSchemaId != null
    )
  );
  const allControls = controls.data?.items ?? [];
  const effectiveControls = allControls.filter(c => c.operating_effectiveness === 'effective');
  const controlCoveragePct =
    allControls.length > 0 ? Math.round((100 * effectiveControls.length) / allControls.length) : null;

  const retention = useRetentionAssignments(
    workspaceSlug,
    retentionConfig,
    retentionFieldIds
  );
  const retentionEnabled = retentionConfig != null && retentionFieldIds != null;
  const incompleteAssignments = useMemo(
    () => retention.rows.filter(row => row.missing.length > 0),
    [retention.rows]
  );

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
  const upcomingAssessments = useMemo(
    () => dedupeById([...riskAssessments, ...controlAssessments]),
    [riskAssessments, controlAssessments]
  );
  const dueSoonCount = useMemo(
    () =>
      upcomingAssessments.filter(assessment => {
        if (assessment.status !== 'open' || assessment.due_at === null) return false;
        const days = daysUntil(assessment.due_at);
        return days <= DUE_SOON_DAYS;
      }).length,
    [upcomingAssessments]
  );

  const outsideAppetite = useMemo(
    () =>
      liveRisks.filter(entity => {
        const band = residualRiskBand(
          typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
        );
        return band === 'high' || band === 'critical';
      }),
    [liveRisks]
  );

  const highestResidualRisks = useMemo(
    () =>
      [...liveRisks]
        .sort((a, b) =>
          -compareNullable(
            typeof a.residual_risk_score === 'number' ? a.residual_risk_score : null,
            typeof b.residual_risk_score === 'number' ? b.residual_risk_score : null
          )
        )
        .slice(0, HIGHEST_RISKS_LIMIT),
    [liveRisks]
  );

  const weakCoverageRisks = useMemo(
    () =>
      liveRisks
        .filter(entity => {
          const band = coverage.byId.get(entity._uid)?.rcBand ?? 'uncovered';
          return band === 'uncovered' || band === 'partial';
        })
        .sort((a, b) =>
          -compareNullable(
            typeof a.residual_risk_score === 'number' ? a.residual_risk_score : null,
            typeof b.residual_risk_score === 'number' ? b.residual_risk_score : null
          )
        )
        .slice(0, WEAK_COVERAGE_LIMIT),
    [liveRisks, coverage.byId]
  );

  const coverageByType = useMemo(() => {
    const groups = new Map<string, EntityRecord[]>();
    allControls.forEach(entity => {
      const key = typeof entity.control_type === 'string' ? entity.control_type : '—';
      const group = groups.get(key) ?? [];
      group.push(entity);
      groups.set(key, group);
    });
    return [...groups.entries()]
      .map(([key, entities]) => ({
        key,
        label: riskFieldValue(controlSchema, entities[0]!, 'control_type'),
        total: entities.length,
        effective: entities.filter(c => c.operating_effectiveness === 'effective').length
      }))
      .sort((a, b) => b.total - a.total);
  }, [allControls, controlSchema]);

  const matrixRisks: RiskComplianceMatrixRisk[] = useMemo(
    () =>
      liveRisks.map(entity => ({
        id: entity._publicId,
        name: entity._name,
        likelihood: typeof entity.likelihood === 'number' ? entity.likelihood : null,
        impact: typeof entity.impact === 'number' ? entity.impact : null,
        residualRiskScore:
          typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
      })),
    [liveRisks]
  );

  const goToSection = (id: (typeof RISK_RISKS_ID | typeof RISK_CONTROLS_ID | typeof RISK_RETENTION_ID | typeof RISK_ASSESSMENTS_ID)) =>
    navigate({ to: RISK_RAIL_PATHS[id], params: { workspaceSlug } });

  const openAssessment = (assessmentId: string) => {
    const assessment = upcomingAssessments.find(candidate => candidate.id === assessmentId);
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
        title="Overview"
        description={`Risk posture, control coverage and what falls due next, across ${liveRisks.length} live risks${riskConfig.controlSchemaId ? ` and ${allControls.length} controls` : ''}.`}
      />

      <div className={styles.tiles}>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Outside appetite</div>
          <div
            className={styles.tileValue}
            style={outsideAppetite.length ? { color: RESIDUAL_RISK_BAND_COLOR.high } : undefined}
          >
            {outsideAppetite.length}
          </div>
          <div className={styles.tileSub}>residual banded high or critical</div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Control coverage</div>
          <div className={styles.tileValue}>
            {controlCoveragePct != null ? `${controlCoveragePct}%` : '—'}
          </div>
          <div className={styles.tileSub}>
            {allControls.length > 0
              ? `${effectiveControls.length} of ${allControls.length} tested effective`
              : 'no controls bound'}
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Retention completeness</div>
          <div
            className={styles.tileValue}
            style={
              retentionEnabled && incompleteAssignments.length
                ? { color: 'var(--cmp-fg-warning, #eab308)' }
                : undefined
            }
          >
            {retentionEnabled ? incompleteAssignments.length : '—'}
          </div>
          <div className={styles.tileSub}>
            {retentionEnabled ? 'assignments missing a required field' : 'retention not configured'}
          </div>
        </div>
        <div className={styles.tile}>
          <div className={styles.tileLabel}>Due in {DUE_SOON_DAYS} days</div>
          <div className={styles.tileValue}>{dueSoonCount}</div>
          <div className={styles.tileSub}>open risk reviews and control tests</div>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>
              {matrixAxis === 'inherent' ? 'Inherent' : 'Residual'} risk — likelihood × impact
            </span>
            <ToggleButtonGroup.Root
              type="single"
              aria-label="Matrix axis"
              value={matrixAxis}
              onChange={value => {
                if (value) setMatrixAxis(value as 'inherent' | 'residual');
              }}
            >
              <ToggleButtonGroup.Item value="inherent">Inherent</ToggleButtonGroup.Item>
              <ToggleButtonGroup.Item value="residual">Residual</ToggleButtonGroup.Item>
            </ToggleButtonGroup.Root>
          </div>
          <RiskComplianceMatrix
            risks={matrixRisks}
            axis={matrixAxis}
            onOpenRisk={id => setOpenRiskId(id)}
          />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Highest residual risks</span>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() => goToSection(RISK_RISKS_ID)}
            >
              Register
            </button>
          </div>
          <div className={styles.stack}>
            {highestResidualRisks.length === 0 ? (
              <div className={`${styles.empty} dim`}>
                {risks.isLoading ? 'Loading risks…' : 'No live risks.'}
              </div>
            ) : (
              highestResidualRisks.map(entity => {
                const band = residualRiskBand(
                  typeof entity.residual_risk_score === 'number' ? entity.residual_risk_score : null
                );
                const entityCoverage = coverage.byId.get(entity._uid);
                return (
                  <button
                    key={entity._uid}
                    type="button"
                    className={styles.row}
                    onClick={() => setOpenRiskId(entity._publicId)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{entity._name}</span>
                      <span className={`${styles.rowSub} dim`}>
                        {entity._publicId} · {riskFieldValue(riskSchema, entity, 'category')} ·{' '}
                        {riskFieldValue(riskSchema, entity, 'risk_owner')}
                      </span>
                    </span>
                    {entityCoverage?.rcBand ? (
                      <Chip dot={COVERAGE_BAND_COLOR[entityCoverage.rcBand]} tone="ghost">
                        {entityCoverage.rcCoverage?.toFixed(0)}%
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                    {band ? (
                      <Chip dot={RESIDUAL_RISK_BAND_COLOR[band]} tone="ghost">
                        {band}
                      </Chip>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={styles.two}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Coverage by control type</span>
            <button
              type="button"
              className={styles.panelLink}
              onClick={() => goToSection(RISK_CONTROLS_ID)}
            >
              Control library
            </button>
          </div>
          <div className={tileStyles.covStack}>
            {coverageByType.length === 0 ? (
              <div className={`${tileStyles.empty} dim`}>
                {controls.isLoading ? 'Loading controls…' : 'No controls bound.'}
              </div>
            ) : (
              coverageByType.map(group => (
                <div key={group.key} className={tileStyles.covRow} style={{ cursor: 'default' }}>
                  <span className={tileStyles.covName}>
                    <span className={tileStyles.covTitle}>{group.label}</span>
                  </span>
                  <span className={styles.typeTrack}>
                    <span
                      className={styles.typeFill}
                      style={{
                        width: `${Math.max(2, (100 * group.effective) / group.total)}%`,
                        background: ratioColor(group.effective, group.total)
                      }}
                    />
                  </span>
                  <span className={`${tileStyles.covPct} mono tabular dim`}>
                    {group.effective}/{group.total}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Risks with weak or missing control</span>
            <span className="dim mono">{weakCoverageRisks.length}</span>
          </div>
          <Table.Root bordered={false}>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell>Risk</Table.HeaderCell>
                <Table.HeaderCell>Category</Table.HeaderCell>
                <Table.HeaderCell>Coverage</Table.HeaderCell>
                <Table.HeaderCell>Residual</Table.HeaderCell>
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {weakCoverageRisks.length === 0 ? (
                <Table.EmptyRow colSpan={4}>
                  {risks.isLoading ? 'Loading risks…' : 'No risks with weak or missing control.'}
                </Table.EmptyRow>
              ) : (
                weakCoverageRisks.map(entity => {
                  const band = residualRiskBand(
                    typeof entity.residual_risk_score === 'number'
                      ? entity.residual_risk_score
                      : null
                  );
                  const entityCoverage = coverage.byId.get(entity._uid);
                  return (
                    <Table.Row key={entity._uid} onClick={() => setOpenRiskId(entity._publicId)}>
                      <Table.NameCell title={entity._name} subtitle={entity._publicId} />
                      <Table.Cell className="dim">
                        {riskFieldValue(riskSchema, entity, 'category')}
                      </Table.Cell>
                      <Table.Cell>
                        {entityCoverage?.rcBand ? (
                          <Chip dot={COVERAGE_BAND_COLOR[entityCoverage.rcBand]} tone="ghost">
                            {entityCoverage.rcCoverage?.toFixed(0)}%
                          </Chip>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </Table.Cell>
                      <Table.Cell>
                        {band ? (
                          <Chip dot={RESIDUAL_RISK_BAND_COLOR[band]} tone="ghost">
                            {band}
                          </Chip>
                        ) : (
                          <span className="dim">—</span>
                        )}
                      </Table.Cell>
                    </Table.Row>
                  );
                })
              )}
            </Table.Body>
          </Table.Root>
        </div>
      </div>

      <div className={styles.two}>
        <AssessmentDuePanel
          title="Upcoming reviews"
          assessments={upcomingAssessments}
          projectsById={projectsById}
          onOpenAssessment={openAssessment}
          showCount={false}
          viewAllLabel="Assessments"
          onViewAll={() => goToSection(RISK_ASSESSMENTS_ID)}
        />

        {retentionEnabled && (
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span className={styles.panelTitle}>Retention — assignments needing attention</span>
              <button
                type="button"
                className={styles.panelLink}
                onClick={() => goToSection(RISK_RETENTION_ID)}
              >
                Retention
              </button>
            </div>
            <div className={styles.stack}>
              {incompleteAssignments.length === 0 ? (
                <div className={`${styles.empty} dim`}>
                  {retention.isLoading ? 'Loading assignments…' : 'Every assignment is complete.'}
                </div>
              ) : (
                incompleteAssignments.slice(0, RETENTION_GAPS_LIMIT).map(row => (
                  <button
                    key={row.uid}
                    type="button"
                    className={styles.row}
                    onClick={() => goToSection(RISK_RETENTION_ID)}
                  >
                    <span className={styles.rowMain}>
                      <span className={styles.rowName}>{row.governedEntityName}</span>
                      <span className={`${styles.rowSub} dim`}>{row.policyName}</span>
                    </span>
                    <Chip tone="ghost" title={`Missing ${row.missing.join(', ')}`}>
                      Missing {row.missing.join(', ')}
                    </Chip>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {openRiskId && (
        <RiskDrawer
          workspaceSlug={workspaceSlug}
          riskId={openRiskId}
          riskConfig={riskConfig}
          onClose={() => setOpenRiskId(null)}
        />
      )}
    </div>
  );
};
