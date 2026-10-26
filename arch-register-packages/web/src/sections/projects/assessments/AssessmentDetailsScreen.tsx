import { useMemo, useState } from 'react';
import { ProgressBar } from '../../../components/ProgressBar';
import { ASSESSMENT_STATUS_LABEL } from '../../../lib/assessmentStatus';
import { TbEdit, TbDots, TbTrash, TbDownload } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectCrudContract';
import type {
  Assessment,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type { EntitySummary } from '@arch-register/api-types/entityContract';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { exportAssessmentResponsesToCSV } from '../../../lib/assessmentCsv';
import { downloadBlob } from '../../../lib/browserDownload';
import { Chip } from '../../../components/Chip';
import { DropdownMenu, type MenuItem } from '../../../components/DropdownMenu';
import { MemberAvatar } from '../../../components/MemberAvatar';
import { DiscussionThread } from '../../discussions/DiscussionThread';
import {
  useProjectAssessments,
  useUpdateAssessment,
  useUpdateAssessmentStatus,
  useDeleteAssessment
} from '../../../hooks/useAssessments';
import { useEntitiesBySchema } from '../../../hooks/useEntities';
import { useAssessmentResponses } from '../../../hooks/useAssessmentResponses';
import { ProjectScreenLayout } from '../shared/ProjectScreenLayout';
import { AssessmentEditorDialog } from './AssessmentEditorDialog';
import { AssessmentResponsesTable } from './AssessmentResponsesTable';
import { AssessmentSummaryTab } from './AssessmentSummaryTab';
import { EmptyState } from '../../../components/EmptyState';
import styles from './AssessmentDetailsScreen.module.css';

import { deriveAssessmentOverview } from './assessmentDetailsViewModel';

const ASSESSMENT_STATUS_COLOR: Record<Assessment['status'], string> = {
  draft: 'var(--cmp-fg-dim)',
  open: 'var(--green)',
  closed: 'var(--warn, orange)',
  archived: 'var(--cmp-fg-disabled)'
};

type AssessmentFormData = Omit<CreateAssessmentRequest, 'project_id'>;

export const AssessmentDetailsScreen = ({
  project,
  projectId,
  assessmentId,
  initialTab,
  onBack
}: {
  project: ProjectDetailData;
  projectId: string;
  assessmentId: string;
  initialTab?: 'details' | 'summary' | 'discussion';
  onBack: () => void;
}) => {
  const { workspaceSlug, schemas, enums } = useWorkspaceContext();

  const { data: assessments = [] } = useProjectAssessments(workspaceSlug, projectId);
  const assessment = assessments.find(a => a.id === assessmentId);
  const updateMutation = useUpdateAssessment(workspaceSlug, project.id);
  const statusMutation = useUpdateAssessmentStatus(workspaceSlug, projectId);
  const deleteMutation = useDeleteAssessment(workspaceSlug, projectId);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const scopeQueries = useEntitiesBySchema(
    workspaceSlug,
    assessment?.scope ?? [],
    assessment?.scope_conditions ?? []
  );
  const entities = useMemo(
    () => scopeQueries.flatMap(q => q.data ?? []) as EntitySummary[],
    [scopeQueries]
  );

  const { data: responses = [] } = useAssessmentResponses(workspaceSlug, assessmentId);
  const [tab, setTab] = useState<'details' | 'summary' | 'discussion'>(initialTab ?? 'details');

  const overview = useMemo(
    () =>
      deriveAssessmentOverview({
        entities,
        responses,
        fields: assessment?.fields ?? [],
        mode: assessment?.mode ?? 'fields'
      }),
    [assessment?.fields, assessment?.mode, entities, responses]
  );
  const { inScopeResponses, assessors, counts } = overview;

  const handleExport = async () => {
    try {
      const blob = await exportAssessmentResponsesToCSV(workspaceSlug, assessmentId);
      downloadBlob(
        blob,
        `${assessment?.name ?? 'assessment'}-results-${new Date().toISOString().split('T')[0]}.csv`
      );
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export assessment results. Please try again.');
    }
  };

  const baseBreadcrumbs = [{ label: 'Assessments', onClick: onBack }];

  if (!assessment) {
    return (
      <ProjectScreenLayout
        projectName={project.name}
        trailingBreadcrumbs={baseBreadcrumbs}
        title="Assessment"
      >
        <EmptyState framed title="Assessment not found" />
      </ProjectScreenLayout>
    );
  }

  const pct = entities.length > 0 ? Math.round((counts.complete / entities.length) * 100) : 0;

  const breadcrumbs = [...baseBreadcrumbs, { label: assessment.name }];

  const handleSave = async (data: AssessmentFormData, status: Assessment['status']) => {
    await updateMutation.mutateAsync({ assessmentId: assessment.id, data });
    if (status !== assessment.status) {
      await statusMutation.mutateAsync({ assessmentId: assessment.id, status });
    }
    setEditing(false);
  };

  const menuItems: MenuItem[] = [
    {
      label: 'Export CSV',
      icon: <TbDownload size={14} />,
      onClick: handleExport
    },
    ...(project.canEdit
      ? [
          {
            label: 'Delete',
            icon: <TbTrash size={14} />,
            danger: true,
            onClick: () => setDeleting(true)
          }
        ]
      : [])
  ];

  return (
    <>
      <ProjectScreenLayout
        projectName={project.name}
        trailingBreadcrumbs={breadcrumbs}
        title={assessment.name}
        chips={
          <Chip dot={ASSESSMENT_STATUS_COLOR[assessment.status]} tone="ghost">
            {ASSESSMENT_STATUS_LABEL[assessment.status]}
          </Chip>
        }
        description={assessment.description}
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
                <button type="button" className={styles.iconBtn}>
                  <TbDots size={14} />
                </button>
              }
              items={menuItems}
            />
          ) : undefined
        }
        meta={
          <div className={styles.metaGroup}>
            {assessors.length > 0 && (
              <div className={styles.assessors}>
                {assessors.map(a => (
                  <MemberAvatar
                    key={a.userId}
                    userId={a.userId}
                    name={a.name}
                    email={null}
                    size={20}
                  />
                ))}
              </div>
            )}
            <div className={styles.progress}>
              <span className={styles.progressLabel}>
                {counts.complete} / {entities.length} complete
              </span>
              <ProgressBar className={styles.progressBar} percent={pct} fillColor="var(--green)" />
            </div>
          </div>
        }
      >
        <div className={styles.tabs}>
          <Tabs.Root
            value={tab}
            onValueChange={v => setTab(v as 'details' | 'summary' | 'discussion')}
          >
            <Tabs.List>
              <Tabs.Trigger value="details">Details</Tabs.Trigger>
              <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
              <Tabs.Trigger value="discussion">Discussion</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="details">
              <AssessmentResponsesTable
                assessment={assessment}
                entities={entities}
                overview={overview}
              />
            </Tabs.Content>
            <Tabs.Content value="summary">
              <AssessmentSummaryTab
                assessment={assessment}
                responses={inScopeResponses}
                entityCount={entities.length}
                enums={enums}
              />
            </Tabs.Content>
            <Tabs.Content value="discussion">
              <div className={styles.discussionPanel}>
                <DiscussionThread
                  workspaceId={workspaceSlug}
                  objectType="assessment"
                  objectId={assessment.id}
                />
              </div>
            </Tabs.Content>
          </Tabs.Root>
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
