import type { Dispatch, SetStateAction } from 'react';
import { TbExternalLink, TbPlus, TbX } from 'react-icons/tb';
import { MultiSelect, MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { DateInput } from '@diagram-craft/app-components/DateInput';
import { Select } from '@diagram-craft/app-components/Select';
import { Chip } from '../../../components/Chip';
import { DiagramMetadataPopover } from '../../../components/DiagramMetadataPopover';
import { asProjectPublicId, projectDiagramHref } from '../../../routes/publicObjectRoutes';
import { formatDate } from '../../../utils/dateFormat';
import { formatCurrencyValue } from '../../../utils/currencyFormat';
import {
  slugifyEntityName,
  relationIds,
  emptyTypedRelationFieldState,
  type TypedRelationEditState,
  type TypedRelationFieldEditState
} from '../../../lib/entityEditState';
import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ExternalMetadataResult } from '@arch-register/api-types/common';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  SupportedCurrency,
  WorkspaceTeam
} from '@arch-register/api-types/workspaceConfigContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';
import type {
  Project,
  ProjectEntity,
  DiagramEntityFile
} from '@arch-register/api-types/projectContract';
import type { RefLookup } from '../types/entityDetailTypes';
import styles from './EntityOverviewTab.module.css';
import sharedStyles from '../EntityDetailScreen.module.css';
import { EntityNavigationLink } from '../../../components/EntityNavigationLink';
import { useMilestones } from '../../../hooks/useMilestones';
import {
  getSnapshotDateLabel,
  toMilestonesById,
  flattenChangeCaseMembers
} from './snapshotDisplay';
import { ExternalMetadataIndicator } from '../../../components/ExternalMetadataIndicator';
import { useFieldGroupAccess } from '../../../auth/useFieldGroupAccess';
import { resolveGroupAccessControl } from '../../../lib/fieldGroupAccess';
import type { FieldGroupAccess } from '@arch-register/permissions';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationRecordDraft } from '@arch-register/api-types/entityContract';
import { RelationRecordList } from './RelationRecordList';
import { TypedRelationFieldEditor } from './TypedRelationFieldEditor';

type EntityProjectAssoc = { project: Project; entity_type: ProjectEntity['entity_type'] };

type Props = {
  workspaceSlug: string;
  entity: EntityRecord;
  schema: EntitySchema | null;
  editing: boolean;
  editState: Record<string, unknown>;
  setEditState: Dispatch<SetStateAction<Record<string, unknown>>>;
  typedRelationEditState: TypedRelationEditState;
  setTypedRelationEditState: Dispatch<SetStateAction<TypedRelationEditState>>;
  editLinks: EntitySummary['_links'];
  setEditLinks: Dispatch<SetStateAction<EntitySummary['_links']>>;
  validationErrors: Set<string>;
  setValidationErrors: Dispatch<SetStateAction<Set<string>>>;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  teams: WorkspaceTeam[];
  lifecycleStates: WorkspaceLifecycleState[];
  currencies: SupportedCurrency[];
  defaultCurrency: string;
  entityProjects: EntityProjectAssoc[];
  changeCases: ChangeCase[];
  entityDiagramFiles: DiagramEntityFile[];
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
};

export const EntityOverviewTab = ({
  workspaceSlug,
  entity,
  schema,
  editing,
  editState,
  setEditState,
  typedRelationEditState,
  setTypedRelationEditState,
  editLinks,
  setEditLinks,
  validationErrors,
  setValidationErrors,
  refLookup,
  referenceOptions,
  teams,
  lifecycleStates,
  currencies,
  defaultCurrency,
  entityProjects,
  changeCases,
  entityDiagramFiles,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas
}: Props) => {
  const futureEntries = flattenChangeCaseMembers(changeCases).filter(
    entry => entry.changeCase.status === 'planned'
  );
  const futureSnapshotProjectIds = [
    ...new Set(
      futureEntries
        .map(entry => entry.changeCase.project_id)
        .filter((id): id is string => id != null)
    )
  ];
  const { data: milestones = [] } = useMilestones(workspaceSlug);
  const milestonesById = toMilestonesById(
    milestones.filter(milestone => futureSnapshotProjectIds.includes(milestone.project_id))
  );

  const getFieldGroupAccess = useFieldGroupAccess(workspaceSlug);

  const getTypedRelationFieldState = (fieldId: string) =>
    typedRelationEditState[fieldId] ?? emptyTypedRelationFieldState();

  const updateTypedRelationFieldState = (
    fieldId: string,
    updater: (state: ReturnType<typeof getTypedRelationFieldState>) => void
  ) => {
    setTypedRelationEditState(prev => {
      const current = prev[fieldId] ?? emptyTypedRelationFieldState();
      const next = {
        create: [...current.create],
        update: new Map(current.update),
        remove: new Set(current.remove)
      };
      updater(next);
      return { ...prev, [fieldId]: next };
    });
  };

  const renderPropertyRow = (
    f: EntitySchema['fields'][number],
    groupAccess: FieldGroupAccess = 'edit'
  ) => (
    <PropertyRow
      key={f.id}
      field={f}
      value={entity[f.id]}
      editing={editing && groupAccess !== 'view'}
      editValue={editState[f.id]}
      typedRelationsOutgoing={typedRelationsOutgoing}
      typedRelationsIncoming={typedRelationsIncoming}
      relationSchemas={relationSchemas}
      currencyOptions={currencies}
      defaultCurrency={defaultCurrency}
      workspaceSlug={workspaceSlug}
      typedRelationFieldState={getTypedRelationFieldState(f.id)}
      onTypedRelationCreate={draft =>
        updateTypedRelationFieldState(f.id, state => {
          state.create.push(draft);
        })
      }
      onTypedRelationRemoveDraft={index =>
        updateTypedRelationFieldState(f.id, state => {
          state.create.splice(index, 1);
        })
      }
      onTypedRelationUpdateField={(relationUid, subFieldId, value) =>
        updateTypedRelationFieldState(f.id, state => {
          const existing = state.update.get(relationUid) ?? {};
          state.update.set(relationUid, { ...existing, [subFieldId]: value });
        })
      }
      onTypedRelationToggleRemove={relationUid =>
        updateTypedRelationFieldState(f.id, state => {
          if (state.remove.has(relationUid)) state.remove.delete(relationUid);
          else state.remove.add(relationUid);
        })
      }
      onChange={v => {
        setEditState(s => ({ ...s, [f.id]: v }));
        if (validationErrors.has(f.id))
          setValidationErrors(s => {
            const n = new Set(s);
            n.delete(f.id);
            return n;
          });
      }}
      refLookup={refLookup}
      referenceOptions={referenceOptions}
      hasError={validationErrors.has(f.id)}
      externalMeta={entity._externalMetadata?.[f.id]}
    />
  );

  const ungroupedFields = schema?.fields.filter(f => !f.groupId) ?? [];
  const groupedSections = (schema?.groups ?? [])
    .map(group => ({
      group,
      fields: schema!.fields.filter(f => f.groupId === group.id),
      access: getFieldGroupAccess(
        resolveGroupAccessControl(group, schema?.shared_field_group_links ?? [])
      )
    }))
    .filter(section => section.fields.length > 0 && section.access !== 'none');

  return (
    <div className={styles.overviewGrid}>
      <div className={styles.propsPanel}>
        {schema && schema.fields.length > 0 && (
          <>
            {ungroupedFields.length > 0 && (
              <>
                <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
                  Properties
                </div>
                <div className={styles.propList}>
                  {ungroupedFields.map(f => renderPropertyRow(f))}
                </div>
              </>
            )}
            {groupedSections.map(({ group, fields: groupFields, access }) => (
              <div key={group.id}>
                <hr className={styles.divider} />
                <div className={styles.sectionLabel}>{group.name}</div>
                {group.description && (
                  <div className={styles.groupDescription}>{group.description}</div>
                )}
                <div className={styles.propList}>
                  {groupFields.map(f => renderPropertyRow(f, access))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className={styles.sidePanel}>
        <div className={styles.sectionLabel} style={{ marginTop: 0 }}>
          Metadata
        </div>
        {schema && <MetaPropRow label="Schema" value={schema.name} />}
        <MetaPropRow label="Public ID" value={entity._publicId} />
        <MetaPropRow label="Namespace" value={entity._namespace} />

        <hr className={styles.divider} />

        <MetaPropRow
          label="Name"
          value={entity._name ?? '—'}
          editing={editing}
          editValue={editState['_name'] as string}
          onChange={v => setEditState(s => ({ ...s, _name: v, _slug: slugifyEntityName(v) }))}
        />
        <MetaPropRow
          label="Slug"
          value={entity._slug}
          editing={editing}
          editValue={editState['_slug'] as string}
          onChange={v => setEditState(s => ({ ...s, _slug: v }))}
        />
        {((entity._description != null && entity._description !== '') || editing) && (
          <div className={styles.metaPropRow}>
            <span className={styles.metaPropLabel}>Description</span>
            <span className={styles.metaPropValue}>
              {editing ? (
                <textarea
                  className={styles.textareaInline}
                  value={editState['_description'] as string}
                  onChange={e => setEditState(s => ({ ...s, _description: e.target.value }))}
                />
              ) : (
                entity._description
              )}
            </span>
          </div>
        )}
        <MetaPropRow
          label="Owner"
          value={entity._owner?.name ?? '—'}
          editing={editing}
          editValue={editState['_owner'] as string}
          onChange={v => setEditState(s => ({ ...s, _owner: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...teams.map(team => ({ value: team.id, label: team.name }))
          ]}
        />
        <MetaPropRow
          label="Lifecycle"
          value={entity._lifecycle?.name ?? '—'}
          editing={editing}
          editValue={editState['_lifecycle'] as string}
          onChange={v => setEditState(s => ({ ...s, _lifecycle: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
          ]}
        />
        <MetaPropRow
          label="Target Lifecycle"
          value={entity._targetLifecycle?.name ?? '—'}
          editing={editing}
          editValue={editState['_targetLifecycle'] as string}
          onChange={v => setEditState(s => ({ ...s, _targetLifecycle: v }))}
          selectOptions={[
            { value: '', label: '—' },
            ...lifecycleStates.map(state => ({ value: state.id, label: state.label }))
          ]}
        />
        <MetaPropRow
          label="Target Date"
          value={entity._targetLifecycleDate ?? '—'}
          editing={editing}
          editValue={editState['_targetLifecycleDate'] as string}
          onChange={v => setEditState(s => ({ ...s, _targetLifecycleDate: v }))}
          type="date"
        />
        {(entity._tags.length > 0 || editing) && (
          <div className={styles.metaPropRow}>
            <span className={styles.metaPropLabel}>Tags</span>
            <span className={styles.metaPropValue}>
              {editing ? (
                <input
                  className={styles.inputInline}
                  value={editState['_tags'] as string}
                  onChange={e => setEditState(s => ({ ...s, _tags: e.target.value }))}
                  placeholder="comma-separated"
                />
              ) : (
                <span className={styles.tags}>
                  {entity._tags.map(t => (
                    <Chip key={t} tone="ghost">
                      {t}
                    </Chip>
                  ))}
                </span>
              )}
            </span>
          </div>
        )}
        {editing ? (
          <div className={styles.linksEdit}>
            <div className={styles.metaPropLabel}>Links</div>
            {editLinks.map((l, i) => (
              <div key={i} className={styles.linkRow}>
                <input
                  className={styles.inputInline}
                  value={l.type ?? ''}
                  onChange={e =>
                    setEditLinks(ls =>
                      ls.map((x, j) => (j === i ? { ...x, type: e.target.value } : x))
                    )
                  }
                  placeholder="Type"
                  style={{ width: 70, flex: 'none' }}
                />
                <input
                  className={styles.inputInline}
                  value={l.title}
                  onChange={e =>
                    setEditLinks(ls =>
                      ls.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                    )
                  }
                  placeholder="Title"
                />
                <input
                  className={styles.inputInline}
                  value={l.url}
                  onChange={e =>
                    setEditLinks(ls =>
                      ls.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                    )
                  }
                  placeholder="URL"
                />
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setEditLinks(ls => ls.filter((_, j) => j !== i))}
                >
                  <TbX size={12} />
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addLinkBtn}
              onClick={() => setEditLinks(ls => [...ls, { url: '', title: '', type: '' }])}
            >
              <TbPlus size={11} /> Add link
            </button>
          </div>
        ) : (
          entity._links.length > 0 &&
          entity._links.map((l, i) => (
            <div key={i} className={styles.metaPropRow}>
              <span className={styles.metaPropLabel}>
                {l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : 'Link'}
              </span>
              <span className={styles.metaPropValue}>
                <a
                  className={styles.propLink}
                  href={l.url.startsWith('http') ? l.url : `https://${l.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TbExternalLink size={11} /> {l.title ?? l.url}
                </a>
              </span>
            </div>
          ))
        )}

        <hr className={styles.divider} />

        <div className={styles.sectionLabel}>Projects</div>
        {entityProjects.length === 0 ? (
          <div className={styles.metaPropRow}>
            <span className={styles.metaPropValue} style={{ color: 'var(--base-fg-more-dim)' }}>
              Not in any project
            </span>
          </div>
        ) : (
          entityProjects.map(({ project, entity_type }) => (
            <div key={project.id} className={styles.metaPropRow}>
              <span className={styles.metaPropLabel}>{project.name}</span>
              <span className={styles.metaPropValue}>
                {entity_type ? (
                  entity_type.name
                ) : (
                  <span style={{ color: 'var(--base-fg-more-dim)' }}>—</span>
                )}
              </span>
            </div>
          ))
        )}

        {futureEntries.length > 0 && (
          <>
            <hr className={styles.divider} />
            <div className={styles.sectionLabel}>Future plans</div>
            {futureEntries.map(entry => {
              const projectName =
                entityProjects.find(ep => ep.project.id === entry.changeCase.project_id)?.project
                  .name ?? entry.changeCase.project_id;
              const dateLabel = entry.changeCase.milestone_id
                ? getSnapshotDateLabel(entry.changeCase, milestonesById)
                : entry.changeCase.target_date
                  ? formatDate(entry.changeCase.target_date)
                  : null;
              return (
                <div key={entry.member.id} className={styles.futurePlan}>
                  <div className={styles.futurePlanMeta}>
                    <span className={styles.futurePlanProject}>{projectName}</span>
                    {dateLabel && <span className={styles.futurePlanDate}>{dateLabel}</span>}
                  </div>
                  {entry.changeCase.commit_message && (
                    <div className={styles.futurePlanNote}>{entry.changeCase.commit_message}</div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <hr className={styles.divider} />

        <div className={styles.sectionLabel}>Diagrams</div>
        {entityDiagramFiles.length === 0 ? (
          <div className={styles.metaPropRow}>
            <span className={styles.metaPropValue} style={{ color: 'var(--base-fg-more-dim)' }}>
              Not in any diagram
            </span>
          </div>
        ) : (
          <div className={styles.miniDiagramList}>
            {entityDiagramFiles.map(({ file, project }) => (
              <DiagramMetadataPopover
                key={file.id}
                type={file.type}
                fallbackTitle={file.name}
                contentMetadata={file.content_metadata}
                commentCount={file.comment_count}
                unresolvedCommentCount={file.unresolved_comment_count}
              >
                <a
                  className={styles.miniDiagramRow}
                  href={projectDiagramHref(
                    workspaceSlug,
                    asProjectPublicId(project.public_id),
                    file.id
                  )}
                >
                  <div className={styles.miniDiagramThumb}>
                    <div className={styles.miniDiagramThumbGrid} />
                    {file.preview_svg ? (
                      <div
                        className={styles.miniDiagramThumbPreview}
                        dangerouslySetInnerHTML={{ __html: file.preview_svg }}
                      />
                    ) : (
                      <svg
                        className={styles.miniDiagramThumbSvg}
                        viewBox="0 0 60 30"
                        preserveAspectRatio="none"
                      >
                        <rect
                          x="3"
                          y="7"
                          width="12"
                          height="7"
                          rx="1"
                          fill="var(--cmp-bg)"
                          stroke="var(--base-fg-more-dim)"
                          strokeWidth="0.7"
                        />
                        <rect
                          x="23"
                          y="3"
                          width="12"
                          height="7"
                          rx="1"
                          fill="var(--cmp-bg)"
                          stroke="var(--base-fg-more-dim)"
                          strokeWidth="0.7"
                        />
                        <rect
                          x="23"
                          y="20"
                          width="12"
                          height="7"
                          rx="1"
                          fill="var(--cmp-bg)"
                          stroke="var(--base-fg-more-dim)"
                          strokeWidth="0.7"
                        />
                        <rect
                          x="43"
                          y="10"
                          width="12"
                          height="7"
                          rx="1"
                          fill="color-mix(in oklch, var(--tag-component) 28%, var(--cmp-bg))"
                          stroke="var(--tag-component)"
                          strokeWidth="0.7"
                        />
                        <path
                          d="M15 10 L23 6 M15 11 L23 23 M35 6 L43 14 M35 23 L43 14"
                          stroke="var(--cmp-fg-disabled)"
                          fill="none"
                          strokeWidth="0.7"
                        />
                      </svg>
                    )}
                  </div>
                  <div className={styles.miniDiagramBody}>
                    <div className={styles.miniDiagramName}>
                      {file.content_metadata?.title ?? file.name}
                    </div>
                    <div className={styles.miniDiagramSub}>{project.name}</div>
                  </div>
                </a>
              </DiagramMetadataPopover>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MetaPropRow = ({
  label,
  value,
  editing,
  editValue,
  onChange,
  selectOptions,
  type = 'text'
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  selectOptions?: Array<{ value: string; label: string }>;
  type?: 'text' | 'date';
}) => (
  <div className={styles.metaPropRow}>
    <span className={styles.metaPropLabel}>{label}</span>
    <span className={styles.metaPropValue}>
      {editing && onChange ? (
        selectOptions ? (
          <select
            className={styles.selectInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          >
            {selectOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : type === 'date' ? (
          <DateInput
            value={editValue ?? ''}
            onChange={v => onChange(v ?? '')}
            style={{ width: '100%' }}
          />
        ) : (
          <input
            className={styles.inputInline}
            value={editValue ?? ''}
            onChange={e => onChange(e.target.value)}
          />
        )
      ) : (
        value
      )}
    </span>
  </div>
);

const PropertyRow = ({
  field,
  value,
  editing,
  editValue,
  onChange,
  refLookup,
  referenceOptions,
  hasError,
  externalMeta,
  typedRelationsOutgoing,
  typedRelationsIncoming,
  relationSchemas,
  currencyOptions,
  defaultCurrency,
  workspaceSlug,
  typedRelationFieldState,
  onTypedRelationCreate,
  onTypedRelationRemoveDraft,
  onTypedRelationUpdateField,
  onTypedRelationToggleRemove
}: {
  field: EntitySchema['fields'][number];
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onChange: (v: unknown) => void;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  hasError?: boolean;
  externalMeta?: ExternalMetadataResult;
  typedRelationsOutgoing: RelationRecord[];
  typedRelationsIncoming: RelationRecord[];
  relationSchemas: RelationSchema[];
  currencyOptions: SupportedCurrency[];
  defaultCurrency: string;
  workspaceSlug: string;
  typedRelationFieldState: TypedRelationFieldEditState;
  onTypedRelationCreate: (draft: RelationRecordDraft) => void;
  onTypedRelationRemoveDraft: (index: number) => void;
  onTypedRelationUpdateField: (relationUid: string, fieldId: string, value: unknown) => void;
  onTypedRelationToggleRemove: (relationUid: string) => void;
}) => {
  const isExternal = field.external_kind !== undefined;
  const isDerived = field.type === 'derived';
  // Inline editing of typedRelation instances lands separately; render read-only for now.
  const isTypedRelation = field.type === 'typedRelation';
  const renderEditor = () => {
    if (field.type === 'reference') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      const availableItems: MultiSelectItem[] = candidates.map(entity => ({
        value: entity._uid,
        label: entity._name ?? entity._slug
      }));
      return (
        <MultiSelect
          selectedValues={relationIds(editValue)}
          availableItems={availableItems}
          onSelectionChange={onChange}
          placeholder={`Search ${field.name.toLowerCase()}...`}
          style={{ width: '100%' }}
        />
      );
    }
    if (field.type === 'containment') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      return (
        <select
          className={styles.selectInline}
          value={relationIds(editValue)[0] ?? ''}
          onChange={e => onChange(e.target.value ? [e.target.value] : [])}
        >
          <option value="">—</option>
          {candidates.map(e => (
            <option key={e._uid} value={e._uid}>
              {e._name ?? e._slug}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'select') {
      return (
        <select
          className={styles.selectInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {field.options.map(o => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    if (field.type === 'longtext') {
      return (
        <textarea
          className={styles.textareaInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    if (field.type === 'boolean') {
      return (
        <input type="checkbox" checked={!!editValue} onChange={e => onChange(e.target.checked)} />
      );
    }
    if (field.type === 'date') {
      return (
        <input
          className={styles.inputInline}
          type="date"
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        />
      );
    }
    if (field.type === 'currency') {
      const currencyValue =
        typeof editValue === 'object' && editValue !== null && !Array.isArray(editValue)
          ? (editValue as { amount?: number; currency?: string })
          : {};
      return (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            className={styles.inputInline}
            type="number"
            step="0.01"
            value={currencyValue.amount ?? ''}
            onChange={e =>
              onChange({
                amount: e.target.value === '' ? undefined : Number(e.target.value),
                currency: currencyValue.currency ?? defaultCurrency
              })
            }
          />
          <Select.Root
            value={currencyValue.currency ?? defaultCurrency}
            onChange={next =>
              onChange({ amount: currencyValue.amount, currency: (next ?? '').toUpperCase() })
            }
            placeholder="Currency"
            style={{ width: 130 }}
          >
            {currencyOptions.map(currency => (
              <Select.Item key={currency.code} value={currency.code}>
                {currency.code} — {currency.label}
              </Select.Item>
            ))}
          </Select.Root>
        </div>
      );
    }
    if (field.type === 'number') {
      return (
        <input
          className={styles.inputInline}
          type="number"
          step="1"
          min={field.min}
          max={field.max}
          value={editValue === undefined || editValue === null ? '' : (editValue as number)}
          onChange={e =>
            onChange(e.target.value === '' ? undefined : Math.trunc(e.target.valueAsNumber))
          }
        />
      );
    }
    return (
      <input
        className={styles.inputInline}
        value={(editValue as string) ?? ''}
        onChange={e => onChange(e.target.value)}
      />
    );
  };

  const renderDisplay = () => {
    if (field.type === 'typedRelation') {
      const records = (
        field.direction === 'out' ? typedRelationsOutgoing : typedRelationsIncoming
      ).filter(record => record._schema.id === field.relationSchemaId);
      if (records.length === 0) return <span className={sharedStyles.dim}>—</span>;
      return (
        <RelationRecordList
          records={records}
          direction={field.direction === 'out' ? 'outgoing' : 'incoming'}
          relationSchema={relationSchemas.find(rs => rs.id === field.relationSchemaId)}
          workspaceId={workspaceSlug}
        />
      );
    }
    if (value == null || value === '') return <span className={sharedStyles.dim}>—</span>;
    if (field.type === 'derived') {
      if (field.resultType === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
      if (field.resultType === 'select') {
        const opt = field.options?.find(o => o.value === String(value));
        return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
      }
      return <span>{String(value)}</span>;
    }
    if (field.type === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
    if (field.type === 'select') {
      const opt = field.options.find(o => o.value === value);
      return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
    }
    if (field.type === 'reference' || field.type === 'containment') {
      const ids = relationIds(value);
      if (ids.length === 0) return <span className={sharedStyles.dim}>—</span>;
      return (
        <>
          {ids.map((id, index) => {
            const ref = refLookup.get(id);
            const label = ref?._name ?? ref?._slug ?? id;
            return (
              <span key={id}>
                {index > 0 && ', '}
                <EntityNavigationLink publicId={ref?._publicId ?? id} className={styles.propLink}>
                  {label}
                </EntityNavigationLink>
              </span>
            );
          })}
        </>
      );
    }
    if (field.type === 'date') return <span>{formatDate(value)}</span>;
    if (field.type === 'currency') return <span>{formatCurrencyValue(value)}</span>;
    return <span>{String(value)}</span>;
  };

  const typeLabel = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  const renderTypedRelationEditor = () => {
    if (field.type !== 'typedRelation') return null;
    const records = (
      field.direction === 'out' ? typedRelationsOutgoing : typedRelationsIncoming
    ).filter(record => record._schema.id === field.relationSchemaId);
    return (
      <TypedRelationFieldEditor
        workspaceId={workspaceSlug}
        field={field}
        relationSchema={relationSchemas.find(rs => rs.id === field.relationSchemaId)}
        existingRecords={records}
        fieldState={typedRelationFieldState}
        onCreate={onTypedRelationCreate}
        onRemoveDraft={onTypedRelationRemoveDraft}
        onUpdateField={onTypedRelationUpdateField}
        onToggleRemove={onTypedRelationToggleRemove}
      />
    );
  };

  return (
    <div className={`${styles.propRow} ${hasError ? styles.propRowError : ''}`}>
      <div className={styles.propLabel}>
        {field.name}
        <span className={styles.propType}>{typeLabel}</span>
        {field.requirementLevel === 'optional' && (
          <span className={styles.propOptional}>(optional)</span>
        )}
        {field.requirementLevel === 'expected' && (
          <span className={styles.propExpected}>Expected</span>
        )}
      </div>
      <div
        className={styles.propValue}
        style={hasError ? { flexDirection: 'column', alignItems: 'flex-start' } : undefined}
      >
        {editing && isTypedRelation
          ? renderTypedRelationEditor()
          : editing && !isExternal && !isDerived
            ? renderEditor()
            : renderDisplay()}
        {isExternal && (
          <ExternalMetadataIndicator kind={field.external_kind!} result={externalMeta} />
        )}
        {hasError && <span className={styles.propErrorMsg}>This field is required</span>}
      </div>
    </div>
  );
};
