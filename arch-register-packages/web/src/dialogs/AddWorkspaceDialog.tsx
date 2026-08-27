import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, KbdHints } from '@diagram-craft/app-components/Dialog';
import { FormElement } from '@diagram-craft/app-components/FormElement';
import { FormSection } from '@diagram-craft/app-components/FormSection';
import { ModeSwitcher } from '@diagram-craft/app-components/ModeSwitcher';
import { Select } from '@diagram-craft/app-components/Select';
import { TextArea } from '@diagram-craft/app-components/TextArea';
import { TextInput } from '@diagram-craft/app-components/TextInput';
import { orpcClient } from '../lib/orpcClient';
import { ApiError } from '../lib/http';
import { SCHEMA_COLORS } from '@arch-register/api-types/colors';
import { Banner } from '../components/Banner';
import { ColorPicker } from '../components/ColorPicker';
import styles from './AddWorkspaceDialog.module.css';
import { Workspace } from '@arch-register/api-types/workspaceContract';
import { useAutoFocus } from '../hooks/useAutoFocus';
import { useQuery } from '@tanstack/react-query';
import { workspaceTemplateCatalogQuery } from '../queries/workspaces';
import type {
  TemplateDependencyDescriptor,
  WorkspaceTemplate
} from '@arch-register/api-types/workspaceContract';

type ApiWorkspace = {
  id: string;
  name: string;
  url_slug: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type AddWorkspaceDialogProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (ws: ApiWorkspace) => void;
};

const COPY_PARTS = [
  { id: 'schemas', label: 'Data model', default: true },
  { id: 'entities', label: 'Entities', default: false },
  { id: 'projects', label: 'Projects & diagrams', default: false },
  { id: 'documents', label: 'Typed documents', default: false },
  { id: 'members', label: 'Members & roles', default: false },
  { id: 'settings', label: 'Settings', default: true }
];

type Mode = 'blank' | 'template' | 'copy';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function initialsOf(s: string) {
  if (!s) return '';
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return ((parts[0]![0] ?? '') + (parts[1]![0] ?? '')).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase();
}

const templateObjectLabel = (count: number) => `${count} template object${count === 1 ? '' : 's'}`;

const templateDefinitionKey = (templateId: string, symbolicId: string) =>
  `${templateId}:${symbolicId}`;

const activeTemplateDependencies = (
  templates: WorkspaceTemplate[],
  fullTemplateId: string,
  crossCuttingTemplateIds: string[],
  mode: Mode
) => {
  const selected = templates.filter(template =>
    mode === 'template'
      ? template.id === fullTemplateId || crossCuttingTemplateIds.includes(template.id)
      : crossCuttingTemplateIds.includes(template.id)
  );
  const selectedIds = new Set(selected.map(template => template.id));
  return selected.flatMap(template =>
    template.dependencies.filter(
      dependency =>
        dependency.required_template_ids.every(id => selectedIds.has(id)) &&
        dependency.required_template_categories.every(category =>
          selected.some(item => item.category === category)
        )
    )
  );
};

const TemplateDependencyMappingSection = ({
  dependencies,
  templates,
  mappings,
  onToggle
}: {
  dependencies: TemplateDependencyDescriptor[];
  templates: WorkspaceTemplate[];
  mappings: Record<string, string[]>;
  onToggle: (dependencyId: string, targetId: string, checked: boolean) => void;
}) => {
  if (dependencies.length === 0) return null;
  return (
    <div className={styles.crossCuttingSection}>
      <div className={styles.sectionLabel}>Resolve template dependencies</div>
      <div className={styles.sectionHint}>
        Select the workspace definitions that should satisfy each selected concern. Every required
        mapping must be completed before the workspace is created.
      </div>
      {dependencies.map(dependency => {
        const candidates = templates
          .flatMap(template =>
            template.definitions
              .filter(definition => definition.kind === dependency.target_kind)
              .map(definition => ({ template, definition }))
          )
          .filter(
            ({ template, definition }, index, all) =>
              all.findIndex(
                item =>
                  templateDefinitionKey(item.template.id, item.definition.symbolic_id) ===
                  templateDefinitionKey(template.id, definition.symbolic_id)
              ) === index
          );
        const selectedTargets = mappings[dependency.id] ?? [];
        return (
          <div className={styles.dependencyMapping} key={dependency.id}>
            <div className={styles.dependencyMappingTitle}>{dependency.name}</div>
            <div className={styles.dependencyMappingDescription}>{dependency.description}</div>
            <div className={styles.checkboxGroup}>
              {candidates.map(({ template, definition }) => {
                const targetId = templateDefinitionKey(
                  definition.template_id,
                  definition.symbolic_id
                );
                return (
                  <label className={styles.checkbox} key={targetId}>
                    <input
                      type="checkbox"
                      checked={selectedTargets.includes(targetId)}
                      onChange={event => onToggle(dependency.id, targetId, event.target.checked)}
                    />
                    {definition.name}
                    <span className={styles.dependencyTargetTemplate}>{template.name}</span>
                  </label>
                );
              })}
              {candidates.length === 0 && (
                <div className={styles.note}>No compatible definitions are available.</div>
              )}
            </div>
            <div className={styles.dependencyMappingRequirement}>
              Select at least {dependency.min_targets} target
              {dependency.min_targets === 1 ? '' : 's'}
              {dependency.max_targets === undefined ? '' : ` and at most ${dependency.max_targets}`}
              .
            </div>
          </div>
        );
      })}
    </div>
  );
};

const CrossCuttingTemplateSection = ({
  templates,
  selected,
  onToggle
}: {
  templates: WorkspaceTemplate[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) => (
  <div className={styles.crossCuttingSection}>
    <div className={styles.sectionLabel}>Cross-cutting concerns</div>
    <div className={styles.sectionHint}>
      Add reusable concerns to this workspace. You can select more than one.
    </div>
    {templates.length === 0 ? (
      <div className={styles.note}>Loading available concerns…</div>
    ) : (
      <div className={styles.templateGrid}>
        {templates.map(template => {
          const checked = selected.includes(template.id);
          return (
            <label
              key={template.id}
              className={`${styles.templateCard} ${checked ? styles.templateCardActive : ''}`}
            >
              <div className={styles.templateCardHead}>
                <span className={styles.templateCardName}>{template.name}</span>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={event => onToggle(template.id, event.target.checked)}
                />
              </div>
              <div className={styles.templateCardDesc}>{template.description}</div>
              <div className={`${styles.templateCardMeta} ${styles.mono}`}>
                {templateObjectLabel(template.template_object_count)}
              </div>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

export const AddWorkspaceDialog = ({ open, onClose, onCreated }: AddWorkspaceDialogProps) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [badgeDirty, setBadgeDirty] = useState(false);
  const [badge, setBadge] = useState('');
  const [color, setColor] = useState(SCHEMA_COLORS[0]!);
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<Mode>('blank');
  const [templateId, setTemplateId] = useState('default');
  const [crossCuttingTemplateIds, setCrossCuttingTemplateIds] = useState<string[]>([]);
  const [dependencyMappings, setDependencyMappings] = useState<Record<string, string[]>>({});
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyParts, setCopyParts] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(COPY_PARTS.map(p => [p.id, p.default]))
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  useAutoFocus(nameRef, { enabled: open, delay: 30 });
  const templatesQuery = useQuery(workspaceTemplateCatalogQuery());
  const templates = (templatesQuery.data ?? []) as WorkspaceTemplate[];
  const fullTemplates = templates.filter(template => template.category === 'full');
  const crossCuttingTemplates = templates.filter(template => template.category === 'cross-cutting');

  useEffect(() => {
    if (fullTemplates.length > 0 && !fullTemplates.some(template => template.id === templateId)) {
      setTemplateId(
        fullTemplates.find(template => template.id === 'default')?.id ?? fullTemplates[0]!.id
      );
    }
  }, [fullTemplates, templateId]);

  useEffect(() => {
    if (!open) return;
    setName('');
    setSlug('');
    setBadge('');
    setDescription('');
    setBadgeDirty(false);
    setColor(SCHEMA_COLORS[0]!);
    setMode('blank');
    setTemplateId('default');
    setCrossCuttingTemplateIds([]);
    setDependencyMappings({});
    setWorkspaces([]);
    setCopyFrom('');
    setCopyParts(Object.fromEntries(COPY_PARTS.map(p => [p.id, p.default])));
    setError('');
  }, [open]);

  useEffect(() => {
    setSlug(slugify(name));
    if (!badgeDirty) setBadge(initialsOf(name));
  }, [name, badgeDirty]);

  useEffect(() => {
    if (mode === 'copy' && workspaces.length === 0) {
      orpcClient.workspaces
        .list()
        .then(ws => {
          setWorkspaces(ws);
          if (ws.length > 0) setCopyFrom(ws[0]!.id);
        })
        .catch(() => {});
    }
  }, [mode, workspaces.length]);

  const activeDependencies = useMemo(
    () => activeTemplateDependencies(templates, templateId, crossCuttingTemplateIds, mode),
    [templates, templateId, crossCuttingTemplateIds, mode]
  );
  const selectedTemplateDefinitions = useMemo(
    () =>
      templates
        .filter(template =>
          mode === 'template'
            ? template.id === templateId || crossCuttingTemplateIds.includes(template.id)
            : crossCuttingTemplateIds.includes(template.id)
        )
        .flatMap(template => template.definitions),
    [templates, templateId, crossCuttingTemplateIds, mode]
  );
  const availableDependencyTargetKeys = useMemo(
    () =>
      new Set(
        selectedTemplateDefinitions.map(definition =>
          templateDefinitionKey(definition.template_id, definition.symbolic_id)
        )
      ),
    [selectedTemplateDefinitions]
  );
  const canResolveDependencies = activeDependencies.every(dependency => {
    const targets = (dependencyMappings[dependency.id] ?? []).filter(targetId =>
      availableDependencyTargetKeys.has(targetId)
    );
    const count = targets.length;
    return (
      count >= dependency.min_targets &&
      (dependency.max_targets === undefined || count <= dependency.max_targets)
    );
  });
  const canCreate =
    name.trim().length > 0 &&
    slug.length > 0 &&
    (mode !== 'copy' || !!copyFrom) &&
    (mode === 'copy' || canResolveDependencies);

  const handleSubmit = useCallback(async () => {
    if (!canCreate) return;
    setSubmitting(true);
    setError('');
    try {
      const body: {
        name: string;
        slug?: string;
        badge?: string;
        color?: string;
        description?: string;
        template?: string;
        cross_cutting_templates?: string[];
        template_dependency_mappings?: Array<{
          dependency_id: string;
          targets: Array<{ template_id: string; sym_id: string }>;
        }>;
        replicate_from?: string;
        include?: string[];
      } = {
        name: name.trim(),
        slug,
        badge: badge ?? initialsOf(name),
        color,
        description: description.trim()
      };
      if (mode === 'template') body.template = templateId;
      if (crossCuttingTemplateIds.length > 0) {
        body.cross_cutting_templates = crossCuttingTemplateIds;
      }
      if (activeDependencies.length > 0) {
        const definitionsByKey = new Map(
          templates
            .filter(template =>
              mode === 'template'
                ? template.id === templateId || crossCuttingTemplateIds.includes(template.id)
                : crossCuttingTemplateIds.includes(template.id)
            )
            .flatMap(template => template.definitions)
            .map(definition => [
              templateDefinitionKey(definition.template_id, definition.symbolic_id),
              definition
            ])
        );
        body.template_dependency_mappings = activeDependencies.map(dependency => ({
          dependency_id: dependency.id,
          targets: (dependencyMappings[dependency.id] ?? []).flatMap(targetId => {
            const definition = definitionsByKey.get(targetId);
            return definition
              ? [{ template_id: definition.template_id, sym_id: definition.symbolic_id }]
              : [];
          })
        }));
      }
      if (mode === 'copy') {
        body.replicate_from = copyFrom;
        body.include = Object.keys(copyParts).filter(k => copyParts[k]);
      }
      const ws = await orpcClient.workspaces.create({ body });
      onCreated(ws);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  }, [
    canCreate,
    name,
    slug,
    badge,
    color,
    description,
    mode,
    templateId,
    crossCuttingTemplateIds,
    activeDependencies,
    dependencyMappings,
    templates,
    copyFrom,
    copyParts,
    onCreated,
    onClose
  ]);

  const activeTemplate = templates.find(t => t.id === templateId);
  const fromWs = workspaces.find(w => w.id === copyFrom);
  const toggleCrossCutting = (id: string, checked: boolean) =>
    setCrossCuttingTemplateIds(previous =>
      checked
        ? [...previous, id].filter((value, index, values) => values.indexOf(value) === index)
        : previous.filter(value => value !== id)
    );
  const toggleDependencyTarget = (dependencyId: string, targetId: string, checked: boolean) =>
    setDependencyMappings(previous => {
      const current = previous[dependencyId] ?? [];
      return {
        ...previous,
        [dependencyId]: checked
          ? [...current, targetId].filter((value, index, values) => values.indexOf(value) === index)
          : current.filter(value => value !== targetId)
      };
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      sup="New workspace"
      title="Create a workspace"
      width={620}
      footerLeft={
        <KbdHints
          hints={[
            ['Esc', 'cancel'],
            ['⌘↵', 'create']
          ]}
        />
      }
      buttons={[
        { label: 'Cancel', type: 'cancel', onClick: onClose },
        {
          label: submitting ? 'Creating...' : 'Create workspace',
          type: 'default',
          disabled: !canCreate || submitting,
          onClick: () => {
            void handleSubmit();
          }
        }
      ]}
    >
      <div className={styles.body}>
        <FormSection step={1} title="Identity">
          <div className={styles.identity}>
            <div className={styles.badgeCol}>
              <div
                className={styles.badgePreview}
                style={{
                  background: color
                    ? `linear-gradient(135deg, ${color}, color-mix(in oklch, ${color} 60%, oklch(0.35 0.12 290)))`
                    : 'var(--cmp-bg-hover)'
                }}
              >
                {badge ?? '—'}
              </div>
              <input
                className={styles.badgeInput}
                value={badge}
                maxLength={2}
                placeholder="AB"
                title="2-character badge"
                onChange={e => {
                  setBadge(e.target.value.toUpperCase());
                  setBadgeDirty(true);
                }}
              />
              <span className={styles.badgeHint}>2 chars</span>
            </div>

            <div className={styles.fields}>
              <FormElement label="Workspace name" required>
                <TextInput
                  ref={nameRef}
                  placeholder="e.g. Acme Payments Platform"
                  value={name}
                  onChange={value => setName(value ?? '')}
                  style={{ width: '100%' }}
                />
              </FormElement>

              <FormElement label="Color" required={false}>
                <ColorPicker
                  value={color}
                  onChange={v => setColor(v ?? SCHEMA_COLORS[0]!)}
                  size="small"
                />
              </FormElement>

              <FormElement label="Description" required={false}>
                <TextArea
                  placeholder="What lives in this workspace? Who owns it?"
                  value={description}
                  onChange={value => setDescription(value ?? '')}
                  rows={3}
                  style={{ width: '100%' }}
                  allowMaximize={false}
                />
              </FormElement>
            </div>
          </div>
        </FormSection>

        <FormSection step={2} title="Schema setup">
          <ModeSwitcher
            modes={[
              { value: 'blank', label: 'Start blank' },
              { value: 'template', label: 'Template' },
              { value: 'copy', label: 'Copy' }
            ]}
            value={mode}
            onChange={setMode}
          />

          {mode === 'blank' && (
            <>
              <div className={styles.note}>
                Starts with no full model. You can still add cross-cutting concerns below.
              </div>
              <CrossCuttingTemplateSection
                templates={crossCuttingTemplates}
                selected={crossCuttingTemplateIds}
                onToggle={toggleCrossCutting}
              />
              <TemplateDependencyMappingSection
                dependencies={activeDependencies}
                templates={templates.filter(template =>
                  crossCuttingTemplateIds.includes(template.id)
                )}
                mappings={dependencyMappings}
                onToggle={toggleDependencyTarget}
              />
            </>
          )}

          {mode === 'template' && (
            <>
              <div className={styles.templateGrid}>
                {templatesQuery.isPending && <div className={styles.note}>Loading templates…</div>}
                {fullTemplates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`${styles.templateCard} ${templateId === t.id ? styles.templateCardActive : ''}`}
                    onClick={() => setTemplateId(t.id)}
                  >
                    <div className={styles.templateCardHead}>
                      <span className={styles.templateCardName}>{t.name}</span>
                      {templateId === t.id && <span className={styles.templateCardCheck}>✓</span>}
                    </div>
                    <div className={styles.templateCardDesc}>{t.description}</div>
                    <div className={`${styles.templateCardMeta} ${styles.mono}`}>
                      {templateObjectLabel(t.template_object_count)}
                    </div>
                  </button>
                ))}
              </div>
              {activeTemplate && (
                <div className={styles.note}>
                  <strong>{activeTemplate.name}</strong> seeds:{' '}
                  {activeTemplate.entity_types.join(', ')}.
                </div>
              )}
              <CrossCuttingTemplateSection
                templates={crossCuttingTemplates}
                selected={crossCuttingTemplateIds}
                onToggle={toggleCrossCutting}
              />
              <TemplateDependencyMappingSection
                dependencies={activeDependencies}
                templates={templates.filter(
                  template =>
                    template.id === templateId || crossCuttingTemplateIds.includes(template.id)
                )}
                mappings={dependencyMappings}
                onToggle={toggleDependencyTarget}
              />
            </>
          )}

          {mode === 'copy' && (
            <div className={styles.copyPanel}>
              <FormElement label="Copy from" required>
                <Select.Root
                  value={copyFrom ?? undefined}
                  onChange={value => setCopyFrom(value ?? '')}
                  placeholder={workspaces.length === 0 ? 'Loading…' : 'Select workspace'}
                  style={{ width: '100%' }}
                >
                  {workspaces.map(ws => (
                    <Select.Item key={ws.id} value={ws.id}>
                      {ws.name}
                    </Select.Item>
                  ))}
                </Select.Root>
              </FormElement>
              <FormElement label="Include" required={false}>
                <div className={styles.copyInclude}>
                  {COPY_PARTS.map(p => (
                    <label key={p.id} className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={!!copyParts[p.id]}
                        onChange={e =>
                          setCopyParts(prev => ({ ...prev, [p.id]: e.target.checked }))
                        }
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </FormElement>
              {fromWs && (
                <div className={styles.note}>
                  Replicates the selected parts of <strong>{fromWs.name}</strong>. Changes won't
                  sync back.
                </div>
              )}
            </div>
          )}
        </FormSection>

        {error && <Banner variant="error">{error}</Banner>}
      </div>
    </Dialog>
  );
};
