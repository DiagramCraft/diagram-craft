import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { TbEdit, TbDots, TbArchive, TbTrash } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type { AssessmentEntityStatus } from '@arch-register/api-types/assessmentStatus';
import { computeAssessmentStatus } from '@arch-register/api-types/assessmentStatus';
import type { CreateAssessmentRequest } from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TypeBadge } from '../../components/TypeBadge';
import { DropdownMenu, type MenuItem } from '../../components/DropdownMenu';
import {
  useAssessments,
  useUpdateAssessment,
  useUpdateAssessmentStatus,
  useDeleteAssessment
} from '../../hooks/useAssessments';
import { useEntitiesBySchema } from '../../hooks/useEntities';
import {
  useAssessmentResponses,
  useUpsertAssessmentResponse
} from '../../hooks/useAssessmentResponses';
import { entityDetailRoute, asEntityPublicId } from '../../routes/publicObjectRoutes';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import { AssessmentEditorDialog } from './ProjectAssessments';
import { AssessmentFieldCell } from './components/AssessmentFieldCells';
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './AssessmentFillScreen.module.css';

type StatusFilter = 'all' | AssessmentEntityStatus;

const STATUS_LABEL: Record<AssessmentEntityStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  complete: 'Complete'
};

export const AssessmentFillScreen = ({
  project,
  projectId,
  assessmentId,
  onNavigateHome,
  onNavigateProject,
  onBack
}: {
  project: ProjectDetailData;
  projectId: string;
  assessmentId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
  onBack: () => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();

  const { data: assessments = [] } = useAssessments(workspaceSlug, projectId);
  const assessment = assessments.find(a => a.id === assessmentId);
  const updateMutation = useUpdateAssessment(workspaceSlug, projectId);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);
  const deleteMutation = useDeleteAssessment(workspaceSlug, projectId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scopeQueries = useEntitiesBySchema(workspaceSlug, assessment?.scope ?? []);
  const entities = useMemo(
    () => scopeQueries.flatMap(q => q.data ?? []) as EntitySummary[],
    [scopeQueries]
  );

  const { data: responses = [] } = useAssessmentResponses(workspaceSlug, projectId, assessmentId);
  const upsertResponse = useUpsertAssessmentResponse(
    workspaceSlug,
    projectId,
    assessmentId,
    assessment?.fields ?? []
  );

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');

  const responseByEntity = useMemo(
    () => new Map(responses.map(r => [r.entity_id, r])),
    [responses]
  );

  const statusFor = (entityId: string): AssessmentEntityStatus =>
    responseByEntity.get(entityId)?.status ??
    computeAssessmentStatus(assessment?.fields ?? [], undefined);

  const counts = useMemo(() => {
    const result: Record<StatusFilter, number> = {
      all: entities.length,
      not_started: 0,
      in_progress: 0,
      complete: 0
    };
    entities.forEach(e => {
      const status =
        responseByEntity.get(e._uid)?.status ??
        computeAssessmentStatus(assessment?.fields ?? [], undefined);
      result[status]++;
    });
    return result;
  }, [entities, responseByEntity, assessment]);

  const filtered = entities.filter(e => {
    if (statusFilter !== 'all' && statusFor(e._uid) !== statusFilter) return false;
    if (search && !e._name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const baseBreadcrumbs = [
    {
      label: 'Home',
      onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
    },
    { label: 'Projects', onClick: onNavigateHome },
    { label: project.name, onClick: onNavigateProject },
    { label: 'Assessments', onClick: onBack }
  ];

  if (!assessment) {
    return (
      <ProjectScreenLayout breadcrumbs={baseBreadcrumbs} title="Assessment">
        <div className={sharedStyles.empty}>
          <div className={sharedStyles.emptyTitle}>Assessment not found</div>
        </div>
      </ProjectScreenLayout>
    );
  }

  const pct = entities.length > 0 ? Math.round((counts.complete / entities.length) * 100) : 0;
  const scopeNames = assessment.scope
    .map(id => schemas.find(s => s.id === id)?.name)
    .filter(Boolean)
    .join(', ');

  const FILTERS: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'not_started', label: 'Not started' },
    { key: 'in_progress', label: 'In progress' },
    { key: 'complete', label: 'Complete' }
  ];

  const breadcrumbs = [...baseBreadcrumbs, { label: assessment.name }];

  const handleSave = async (data: CreateAssessmentRequest) => {
    await updateMutation.mutateAsync({ assessmentId: assessment.id, data });
    setEditing(false);
  };

  const menuItems: MenuItem[] = project.canEdit
    ? [
        {
          label: assessment.status === 'archived' ? 'Restore' : 'Archive',
          icon: <TbArchive size={14} />,
          onClick: () => {
            statusMutation.mutate({
              assessmentId: assessment.id,
              status: assessment.status === 'archived' ? 'active' : 'archived'
            });
            onBack();
          }
        },
        {
          label: 'Delete',
          icon: <TbTrash size={14} />,
          danger: true,
          onClick: () => setDeleting(true)
        }
      ]
    : [];

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={breadcrumbs}
        title={assessment.name}
        description={scopeNames}
        actions={
          project.canEdit ? (
            <Button icon={<TbEdit size={12} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : undefined
        }
        menu={
          menuItems.length > 0 ? (
            <DropdownMenu
              trigger={
                <button type="button" className={sharedStyles.iconBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={menuItems}
            />
          ) : undefined
        }
        meta={
          <div className={styles.progress}>
            <span className={styles.progressLabel}>
              {counts.complete} / {entities.length} complete
            </span>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${pct}%` }} />
            </div>
          </div>
        }
      >
        <div className={styles.panel}>
          <div className={styles.toolbar}>
            <div className={styles.filterGroup}>
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`${styles.filterPill} ${statusFilter === key ? styles.filterPillActive : ''}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label} ({counts[key]})
                </button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <TextInput
              value={search}
              onChange={v => setSearch(v ?? '')}
              placeholder="Search entities…"
              style={{ width: 220 }}
            />
          </div>

          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th className={styles.entCol}>Entity</th>
                  {assessment.fields.map(f => (
                    <th key={f.id}>
                      {f.label}
                      {f.requirementLevel === 'required' && <span className={styles.req}> *</span>}
                    </th>
                  ))}
                  <th className={styles.statusCol}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td className={styles.emptyRow} colSpan={assessment.fields.length + 2}>
                      <div className={`${sharedStyles.empty} ${styles.emptyRowInner}`}>
                        <div className={sharedStyles.emptyTitle}>No entities match this filter</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map(entity => {
                    const meta = schemas.find(s => s.id === entity._schema.id);
                    const idx = meta ? schemas.indexOf(meta) : -1;
                    const color = meta ? resolveSchemaColor(meta, idx) : '#888';
                    const values = responseByEntity.get(entity._uid)?.values ?? {};
                    const status = statusFor(entity._uid);

                    return (
                      <tr key={entity._uid}>
                        <td className={styles.entCol}>
                          <div className={styles.entName}>
                            <TypeBadge
                              color={color}
                              name={meta?.name}
                              icon={meta?.icon}
                              size={16}
                            />
                            <button
                              type="button"
                              className={styles.entNameBtn}
                              title={entity._name}
                              onClick={() =>
                                navigate(
                                  entityDetailRoute(
                                    workspaceSlug,
                                    asEntityPublicId(entity._publicId)
                                  )
                                )
                              }
                            >
                              {entity._name || entity._slug}
                            </button>
                          </div>
                        </td>
                        {assessment.fields.map(field => (
                          <td key={field.id} className={styles.cell}>
                            <AssessmentFieldCell
                              field={field}
                              value={values[field.id]}
                              onChange={value =>
                                upsertResponse.mutate({
                                  entityId: entity._uid,
                                  values: { [field.id]: value }
                                })
                              }
                            />
                          </td>
                        ))}
                        <td className={styles.statusCol}>
                          <span className={`${styles.statusDot} ${styles[`st-${status}`]}`} />
                          {STATUS_LABEL[status]}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ProjectScreenLayout>

      {editing && (
        <AssessmentEditorDialog
          assessment={assessment}
          schemas={schemas}
          isSaving={updateMutation.isPending}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
        />
      )}

      <DeleteConfirmationDialog
        open={deleting}
        title="Delete assessment?"
        message={
          <>
            <b>{assessment.name}</b> will be permanently deleted
            {assessment.response_count > 0
              ? `, along with ${assessment.response_count} recorded response${assessment.response_count !== 1 ? 's' : ''}.`
              : '.'}
          </>
        }
        detail="This can't be undone."
        confirmLabel="Delete assessment"
        onConfirm={() => {
          deleteMutation.mutate(assessment.id);
          setDeleting(false);
          onBack();
        }}
        onCancel={() => setDeleting(false)}
      />
    </>
  );
};
