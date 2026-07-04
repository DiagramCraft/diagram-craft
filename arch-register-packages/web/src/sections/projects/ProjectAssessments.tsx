import { useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { Button } from '@diagram-craft/app-components/Button';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import {
  TbPlus,
  TbTrash,
  TbClipboardList,
  TbDatabase,
  TbStar,
  TbListCheck,
  TbAlignLeft
} from 'react-icons/tb';
import type { ProjectDetail as ProjectDetailData } from '@arch-register/api-types/projectContract';
import type {
  Assessment,
  AssessmentField,
  CreateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TypeBadge } from '../../components/TypeBadge';
import { ProjectScreenLayout } from './ProjectScreenLayout';
import sharedStyles from './ProjectDetailScreen.module.css';
import styles from './ProjectAssessments.module.css';
import { useAssessments, useCreateAssessment } from '../../hooks/useAssessments';
import { useEntitiesBySchema } from '../../hooks/useEntities';

type StatusFilter = 'active' | 'archived' | 'all';

const FIELD_TYPE_META: Record<AssessmentField['type'], { icon: typeof TbStar; hint: string | null }> = {
  rating: { icon: TbStar, hint: '1 – 5' },
  enum: { icon: TbDatabase, hint: null },
  text: { icon: TbAlignLeft, hint: 'free text' }
};

export const ProjectAssessments = ({
  project,
  projectId,
  onNavigateHome,
  onNavigateProject
}: {
  project: ProjectDetailData;
  // The raw project route param (may be the public id) — kept distinct from
  // project.id (the resolved internal id) so the query key here matches the
  // one ProjectContentSidebar uses, keeping their caches in sync.
  projectId: string;
  onNavigateHome: () => void;
  onNavigateProject: () => void;
}) => {
  const navigate = useNavigate();
  const { workspaceSlug, schemas } = useWorkspaceContext();

  const { data: assessments = [] } = useAssessments(workspaceSlug, projectId);
  const createMutation = useCreateAssessment(workspaceSlug, projectId);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [creating, setCreating] = useState(false);

  const schemaColorMap = useMemo(() => {
    const m = new Map<string, { color: string; icon: string | null }>();
    schemas.forEach((s, i) => m.set(s.id, { color: resolveSchemaColor(s, i), icon: s.icon ?? null }));
    return m;
  }, [schemas]);

  const counts = {
    active: assessments.filter(a => a.status === 'active').length,
    archived: assessments.filter(a => a.status === 'archived').length,
    all: assessments.length
  };

  const filtered = assessments.filter(a => statusFilter === 'all' || a.status === statusFilter);

  const handleSave = async (data: CreateAssessmentRequest) => {
    await createMutation.mutateAsync(data);
    setCreating(false);
  };

  return (
    <>
      <ProjectScreenLayout
        breadcrumbs={[
          { label: 'Home', onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } }) },
          { label: 'Projects', onClick: onNavigateHome },
          { label: project.name, onClick: onNavigateProject }
        ]}
        title="Assessments"
        actions={
          project.canEdit ? (
            <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
              New assessment
            </Button>
          ) : undefined
        }
        toolbar={
          <div className={sharedStyles.entityTabNav}>
            {(
              [
                ['active', `Active (${counts.active})`],
                ['archived', `Archived (${counts.archived})`],
                ['all', `All (${counts.all})`]
              ] as [StatusFilter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`${sharedStyles.entityTabBtn} ${statusFilter === key ? sharedStyles.entityTabBtnActive : ''}`}
                onClick={() => setStatusFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <div className={styles.list}>
            <div className={sharedStyles.empty}>
              <div className={sharedStyles.emptyIcon}>
                <TbClipboardList size={20} />
              </div>
              <div className={sharedStyles.emptyTitle}>
                {statusFilter === 'active'
                  ? 'No active assessments'
                  : statusFilter === 'archived'
                    ? 'No archived assessments'
                    : 'No assessments yet'}
              </div>
              <div className={sharedStyles.emptySub}>
                Assessments collect structured scores and notes on entities in this project.
              </div>
              {project.canEdit && statusFilter !== 'archived' && (
                <Button variant="primary" icon={<TbPlus size={12} />} onClick={() => setCreating(true)}>
                  New assessment
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.list}>
            {filtered.map(assessment => (
              <AssessmentCard
                key={assessment.id}
                assessment={assessment}
                schemaColorMap={schemaColorMap}
                schemas={schemas}
                onOpen={() =>
                  navigate({
                    search: ((previous: Record<string, unknown>) => ({
                      ...previous,
                      assessmentId: assessment.id
                    })) as never
                  })
                }
              />
            ))}
          </div>
        )}
      </ProjectScreenLayout>

      {creating && (
        <AssessmentEditorDialog
          assessment={null}
          schemas={schemas}
          isSaving={createMutation.isPending}
          onSave={handleSave}
          onCancel={() => setCreating(false)}
        />
      )}
    </>
  );
};

const AssessmentCard = ({
  assessment,
  schemaColorMap,
  schemas,
  onOpen
}: {
  assessment: Assessment;
  schemaColorMap: Map<string, { color: string; icon: string | null }>;
  schemas: { id: string; name: string }[];
  onOpen: () => void;
}) => {
  const isArchived = assessment.status === 'archived';
  const scopeSchemas = assessment.scope
    .map(id => schemas.find(s => s.id === id))
    .filter((s): s is { id: string; name: string } => !!s);

  const { workspaceSlug } = useWorkspaceContext();
  const scopeQueries = useEntitiesBySchema(workspaceSlug, assessment.scope);
  const inScopeCount = scopeQueries.reduce((sum, q) => sum + (q.data?.length ?? 0), 0);
  const pct = inScopeCount > 0 ? Math.round((assessment.completed_entity_count / inScopeCount) * 100) : 0;

  return (
    <button
      type="button"
      className={`${styles.card} ${isArchived ? styles.cardArchived : ''}`}
      onClick={onOpen}
    >
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <div className={styles.cardName}>{assessment.name}</div>
          <span className={`${styles.status} ${isArchived ? styles.statusArchived : styles.statusActive}`}>
            {assessment.status}
          </span>
        </div>
        {assessment.description && <div className={styles.cardDesc}>{assessment.description}</div>}
        <div className={styles.cardMeta}>
          <span className={styles.metaItem}>
            <TbListCheck size={11} />
            {assessment.fields.length} field{assessment.fields.length !== 1 ? 's' : ''}
          </span>
          {scopeSchemas.length > 0 && (
            <span className={styles.metaItem}>
              <TbDatabase size={11} />
              <span className={styles.metaScope}>
                {scopeSchemas.map((s, i) => {
                  const meta = schemaColorMap.get(s.id);
                  return (
                    <span key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {i > 0 && <span>·</span>}
                      <TypeBadge color={meta?.color ?? '#888'} icon={meta?.icon} size={13} />
                      {s.name}
                    </span>
                  );
                })}
              </span>
            </span>
          )}
        </div>
        {!isArchived && inScopeCount > 0 && (
          <div className={styles.completion}>
            <span className={styles.completionLabel}>
              {assessment.completed_entity_count} / {inScopeCount}
            </span>
            <div className={styles.completionBar}>
              <div className={styles.completionFill} style={{ width: `${pct}%` }} />
            </div>
            <span className={styles.completionPct}>{pct}%</span>
          </div>
        )}
      </div>
    </button>
  );
};

export const AssessmentEditorDialog = ({
  assessment,
  schemas,
  isSaving,
  onSave,
  onCancel
}: {
  assessment: Assessment | null;
  schemas: { id: string; name: string; color: string | null; icon: string | null }[];
  isSaving: boolean;
  onSave: (data: CreateAssessmentRequest) => void;
  onCancel: () => void;
}) => {
  const isNew = !assessment;
  const [name, setName] = useState(assessment?.name ?? '');
  const [description, setDescription] = useState(assessment?.description ?? '');
  const [scope, setScope] = useState<string[]>(assessment?.scope ?? []);
  const [fields, setFields] = useState<AssessmentField[]>(assessment?.fields.map(f => ({ ...f })) ?? []);

  const toggleScope = (id: string) =>
    setScope(prev => (prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]));

  const addField = (type: AssessmentField['type']) => {
    const base = { id: `f${Date.now()}`, label: '', requirementLevel: 'required' as const };
    setFields(prev => [
      ...prev,
      type === 'enum' ? { ...base, type, enumId: '' } : { ...base, type }
    ]);
  };

  const updateField = (id: string, changes: Partial<AssessmentField>) =>
    setFields(prev => prev.map(f => (f.id === id ? ({ ...f, ...changes } as AssessmentField) : f)));

  const removeField = (id: string) => setFields(prev => prev.filter(f => f.id !== id));

  const canSave = name.trim().length > 0;

  return (
    <Dialog
      open
      onClose={onCancel}
      title={isNew ? 'New assessment' : 'Edit assessment'}
      width={600}
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onCancel },
        {
          label: isSaving ? 'Saving...' : isNew ? 'Create assessment' : 'Save changes',
          type: 'default',
          disabled: !canSave || isSaving,
          onClick: () =>
            onSave({
              name: name.trim(),
              description: description.trim(),
              scope,
              fields
            })
        }
      ]}
    >
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Basic info</div>
        <TextInput value={name} onChange={v => setName(v ?? '')} placeholder="e.g. Security Readiness" style={{ width: '100%' }} />
        <TextInput
          value={description}
          onChange={v => setDescription(v ?? '')}
          placeholder="Optional — explain the purpose of this assessment"
          style={{ width: '100%' }}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Scope</div>
        <div className={styles.sectionHint}>Which entity types does this assessment apply to?</div>
        <div className={styles.scopeGrid}>
          {schemas.map(schema => {
            const on = scope.includes(schema.id);
            return (
              <button
                key={schema.id}
                type="button"
                className={`${styles.scopeChip} ${on ? styles.scopeChipOn : ''}`}
                onClick={() => toggleScope(schema.id)}
              >
                <TypeBadge color={schema.color ?? '#888'} icon={schema.icon} size={16} />
                <span>{schema.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionRow}>
          <div className={styles.sectionLabel}>Fields{fields.length > 0 ? ` (${fields.length})` : ''}</div>
          <div className={styles.fieldAddButtons}>
            {FIELD_TYPE_OPTIONS.map(([type, label]) => (
              <Button key={type} icon={<TbPlus size={11} />} onClick={() => addField(type)}>
                {label}
              </Button>
            ))}
          </div>
        </div>
        {fields.length === 0 ? (
          <div className={styles.fieldsEmpty}>No fields yet — add a Rating, Select, or Notes field above.</div>
        ) : (
          <div className={styles.fieldsList}>
            {fields.map(field => (
              <FieldRow key={field.id} field={field} onUpdate={changes => updateField(field.id, changes)} onRemove={() => removeField(field.id)} />
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
};

const FIELD_TYPE_OPTIONS: [AssessmentField['type'], string][] = [
  ['rating', 'Rating'],
  ['enum', 'Select'],
  ['text', 'Notes']
];

const FieldRow = ({
  field,
  onUpdate,
  onRemove
}: {
  field: AssessmentField;
  onUpdate: (changes: Partial<AssessmentField>) => void;
  onRemove: () => void;
}) => {
  const { enums } = useWorkspaceContext();
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta.icon;
  const placeholders: Record<AssessmentField['type'], string> = {
    rating: 'Rating label…',
    enum: 'Select label…',
    text: 'Notes label…'
  };

  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldTypeIcon}>
        <Icon size={13} />
      </div>
      <TextInput
        value={field.label}
        onChange={v => onUpdate({ label: v ?? '' })}
        placeholder={placeholders[field.type]}
        style={{ flex: 1, minWidth: 0 }}
      />
      {field.type === 'enum' && (
        <div className={styles.fieldEnum}>
          <Select.Root
            value={field.enumId}
            placeholder="Choose enum…"
            onChange={v => onUpdate({ enumId: v ?? '' } as Partial<AssessmentField>)}
          >
            {enums.map(en => (
              <Select.Item key={en.id} value={en.id}>
                {en.name}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      )}
      {meta.hint && <span className={styles.fieldHint}>{meta.hint}</span>}
      <div className={styles.fieldRequirement}>
        <Select.Root
          value={field.requirementLevel}
          onChange={v => onUpdate({ requirementLevel: (v ?? 'required') as 'required' | 'optional' })}
        >
          <Select.Item value="required">Required</Select.Item>
          <Select.Item value="optional">Optional</Select.Item>
        </Select.Root>
      </div>
      <Button variant="ghost" icon={<TbTrash size={13} />} onClick={onRemove} title="Remove field" />
    </div>
  );
};
