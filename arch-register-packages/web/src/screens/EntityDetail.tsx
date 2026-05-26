import { useState, useEffect, useMemo, useCallback } from 'react';
import styles from './EntityDetail.module.css';
import { TypeBadge } from '../components/TypeBadge';
import { StatusChip } from '../components/StatusChip';
import { Chip } from '../components/Chip';
import {
  TbChevronLeft, TbChevronRight, TbEdit, TbDots, TbExternalLink, TbStar,
  TbTrash, TbPlus, TbX,
} from 'react-icons/tb';
import type { NavigateFn } from '../routing';
import { apiFetch, fetchEntities, fetchEntity as fetchEntityById, fetchEntityRelations, resolveSchemaColor, fetchAuditLog } from '../api';
import type { EntityRecord, EntityRelations, EntitySchema, EntitySummary, SchemaField, AuditLogEntry } from '../api';

type EntityDetailProps = {
  workspaceId: string;
  entityId: string;
  schemas: EntitySchema[];
  navigate: NavigateFn;
};

type TabId = 'overview' | 'relations' | 'changes';

type Relation = {
  entityId: string;
  entitySlug: string;
  entityName: string;
  entitySchemaId: string;
  fieldName: string;
  kind: 'reference' | 'containment';
};

type RefLookup = Map<string, EntitySummary>;

const slugify = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const EntityDetail = ({ workspaceId, entityId, schemas, navigate }: EntityDetailProps) => {
  const [entity, setEntity] = useState<EntityRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('overview');
  const [editing, setEditing] = useState(false);
  const [editState, setEditState] = useState<Record<string, unknown>>({});
  const [editLinks, setEditLinks] = useState<EntitySummary['_links']>([]);
  const [saving, setSaving] = useState(false);
  const [refLookup, setRefLookup] = useState<RefLookup>(new Map());
  const [relations, setRelations] = useState<EntityRelations>({ outgoing: [], incoming: [] });
  const [referenceOptions, setReferenceOptions] = useState<Record<string, EntitySummary[]>>({});
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const refreshRelations = useCallback(() => {
    fetchEntityRelations(workspaceId, entityId)
      .then(nextRelations => {
        setRelations(nextRelations);
        const lookup: RefLookup = new Map();
        nextRelations.outgoing.forEach(relation => {
          lookup.set(relation.entityId, {
            _uid: relation.entityId,
            _workspace: workspaceId,
            _schemaId: relation.entitySchemaId,
            _name: relation.entityName,
            _slug: relation.entitySlug,
            _namespace: '',
            _description: '',
            _owner: null,
            _lifecycle: null,
            _tags: [],
            _links: [],
          });
        });
        setRefLookup(lookup);
      })
      .catch(() => {
        setRelations({ outgoing: [], incoming: [] });
        setRefLookup(new Map());
      });
  }, [workspaceId, entityId]);

  const refreshEntity = useCallback(() => {
    setLoading(true);
    fetchEntityById(workspaceId, entityId)
      .then(data => {
        setEntity(data);
        setLoading(false);
      })
      .catch(() => {
        setEntity(null);
        setLoading(false);
      });
  }, [workspaceId, entityId]);

  useEffect(() => {
    refreshEntity();
  }, [refreshEntity]);

  useEffect(() => {
    refreshRelations();
  }, [refreshRelations]);

  useEffect(() => {
    if (tab === 'changes' && entityId) {
      setLoadingAudit(true);
      fetchAuditLog(workspaceId, { entityId, limit: 100 })
        .then(log => {
          setAuditLog(log);
          setLoadingAudit(false);
        })
        .catch(() => {
          setAuditLog([]);
          setLoadingAudit(false);
        });
    }
  }, [tab, entityId, workspaceId]);

  const schemaEntry = useMemo(() => {
    if (!entity) return null;
    let idx = 0;
    for (const s of schemas) {
      if (s.id === entity._schemaId) return { schema: s, index: idx };
      idx++;
    }
    return null;
  }, [entity, schemas]);

  const schema = schemaEntry?.schema ?? null;
  const color = schemaEntry ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index) : 'var(--accent)';

  useEffect(() => {
    if (!schema) {
      setReferenceOptions({});
      return;
    }

    const targetSchemaIds = [...new Set(
      schema.fields
        .filter((field): field is Extract<SchemaField, { type: 'reference' | 'containment' }> =>
          field.type === 'reference' || field.type === 'containment'
        )
        .map(field => field.schemaId)
        .filter(Boolean)
    )];

    if (targetSchemaIds.length === 0) {
      setReferenceOptions({});
      return;
    }

    Promise.all(
      targetSchemaIds.map(async schemaId => ({
        schemaId,
        entities: await fetchEntities(workspaceId, { schemaId, view: 'summary' }),
      }))
    )
      .then(results => {
        const nextOptions: Record<string, EntitySummary[]> = {};
        results.forEach(result => {
          nextOptions[result.schemaId] = result.entities;
        });
        setReferenceOptions(nextOptions);
      })
      .catch(() => setReferenceOptions({}));
  }, [workspaceId, schema]);

  const outgoing: Relation[] = relations.outgoing;
  const incoming: Relation[] = relations.incoming;

  const relationCount = outgoing.length + incoming.length;

  const startEdit = () => {
    if (!entity || !schema) return;
    const state: Record<string, unknown> = {
      _name: entity._name ?? '',
      _slug: entity._slug ?? '',
      _description: entity._description ?? '',
      _owner: entity._owner ?? '',
      _lifecycle: entity._lifecycle ?? '',
      _namespace: entity._namespace ?? '',
      _tags: (entity._tags ?? []).join(', '),
    };
    for (const f of schema.fields) {
      state[f.id] = entity[f.id] ?? '';
    }
    setEditState(state);
    setEditLinks(entity._links.map(l => ({ ...l })));
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditState({});
    setEditLinks([]);
  };

  const saveEdit = async () => {
    if (!entity || !schema) return;
    setSaving(true);

    const dataFields: Record<string, unknown> = {};
    for (const f of schema.fields) {
      dataFields[f.id] = editState[f.id] ?? '';
    }

    const tagsStr = (editState['_tags'] as string) ?? '';
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);

    const body = {
      _schemaId: entity._schemaId,
      _name: (editState['_name'] as string) ?? '',
      _slug: (editState['_slug'] as string) || entity._slug,
      _namespace: (editState['_namespace'] as string) || entity._namespace,
      _description: (editState['_description'] as string) ?? '',
      _owner: (editState['_owner'] as string) || null,
      _lifecycle: (editState['_lifecycle'] as string) || null,
      _tags: tags,
      _links: editLinks.filter(l => l.url.trim() !== ''),
      ...dataFields,
    };

    try {
      const updated = await apiFetch<EntityRecord>(`/api/${workspaceId}/data/${entityId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setEntity(updated);
      refreshRelations();
      setEditing(false);
      setEditState({});
      setEditLinks([]);
    } catch {
      // keep editing on failure
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/${workspaceId}/data/${entityId}`, { method: 'DELETE' });
      navigate({ view: 'entity-browser' });
    } catch {
      // ignore
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (!entity) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>Entity not found</div>
        <div>The entity may have been deleted.</div>
        <button type="button" className={styles.btn} onClick={() => navigate({ view: 'entity-browser' })}>
          <TbChevronLeft size={12} /> Back to entities
        </button>
      </div>
    );
  }

  const entityName = entity._name || entity._slug;

  return (
    <div className={styles.screen}>
      {/* Header */}
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <button type="button" className={styles.backLink} onClick={() => navigate({ view: 'entity-browser' })}>
            <TbChevronLeft size={12} /> Back to entities
          </button>
          <div className={styles.headRow}>
            <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={32} />
            <div>
              <div className={styles.eyebrow}>{schema?.name ?? 'Entity'}</div>
              <div className={styles.title}>{entityName}</div>
            </div>
            {entity._lifecycle && <StatusChip value={entity._lifecycle} />}
          </div>
          {entity._description && <div className={styles.desc}>{entity._description}</div>}
        </div>
        <div className={styles.headActions}>
          <button type="button" className={styles.iconBtn} title="Star"><TbStar size={14} /></button>
          {!editing ? (
            <button type="button" className={styles.btn} onClick={startEdit}><TbEdit size={12} /> Edit</button>
          ) : (
            <>
              <button type="button" className={styles.btnDanger} onClick={handleDelete}>
                <TbTrash size={12} /> Delete
              </button>
              <button type="button" className={styles.btn} onClick={cancelEdit}>Cancel</button>
              <button type="button" className={styles.btnPrimary} onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
          <button type="button" className={styles.iconBtn}><TbDots size={14} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'overview' ? styles.tabActive : ''}`}
            onClick={() => setTab('overview')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'relations' ? styles.tabActive : ''}`}
            onClick={() => setTab('relations')}
          >
            Relationships{relationCount > 0 ? ` (${relationCount})` : ''}
          </button>
          <button
            type="button"
            className={`${styles.tab} ${tab === 'changes' ? styles.tabActive : ''}`}
            onClick={() => setTab('changes')}
          >
            Change history
          </button>
        </div>
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className={styles.overviewGrid}>
          <div className={styles.propsPanel}>
            {schema && schema.fields.length > 0 && (
              <>
                <div className={styles.sectionLabel} style={{ marginTop: 0 }}>Properties</div>
                <div className={styles.propList}>
                  {schema.fields.map(f => (
                    <PropertyRow
                      key={f.id}
                      field={f}
                      value={entity[f.id]}
                      editing={editing}
                      editValue={editState[f.id]}
                      onChange={v => setEditState(s => ({ ...s, [f.id]: v }))}
                      refLookup={refLookup}
                      referenceOptions={referenceOptions}
                      navigate={navigate}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.sectionLabel} style={{ marginTop: 0 }}>Metadata</div>
            {schema && <MetaPropRow label="Schema" value={schema.name} />}
            <MetaPropRow label="UID" value={entity._uid} />
            <MetaPropRow label="Workspace" value={entity._workspace} />
            <MetaPropRow label="Namespace" value={entity._namespace} />

            <hr className={styles.divider} />

            <MetaPropRow label="Name" value={entity._name || '—'} editing={editing} editValue={editState['_name'] as string} onChange={v => setEditState(s => ({ ...s, _name: v, _slug: slugify(v) }))} />
            <MetaPropRow label="Slug" value={entity._slug} editing={editing} editValue={editState['_slug'] as string} onChange={v => setEditState(s => ({ ...s, _slug: v }))} />
            {(entity._description || editing) && (
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
            <MetaPropRow label="Owner" value={entity._owner ?? '—'} editing={editing} editValue={editState['_owner'] as string} onChange={v => setEditState(s => ({ ...s, _owner: v }))} />
            <MetaPropRow label="Lifecycle" value={entity._lifecycle ?? '—'} editing={editing} editValue={editState['_lifecycle'] as string} onChange={v => setEditState(s => ({ ...s, _lifecycle: v }))} selectOptions={['', 'proposed', 'experimental', 'production', 'deprecated']} />
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
                      {entity._tags.map(t => <Chip key={t} tone="ghost">{t}</Chip>)}
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
                      onChange={e => setEditLinks(ls => ls.map((x, j) => j === i ? { ...x, type: e.target.value } : x))}
                      placeholder="Type"
                      style={{ width: 70, flex: 'none' }}
                    />
                    <input
                      className={styles.inputInline}
                      value={l.title}
                      onChange={e => setEditLinks(ls => ls.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                      placeholder="Title"
                    />
                    <input
                      className={styles.inputInline}
                      value={l.url}
                      onChange={e => setEditLinks(ls => ls.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
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
            ) : entity._links.length > 0 && (
              entity._links.map((l, i) => (
                <div key={i} className={styles.metaPropRow}>
                  <span className={styles.metaPropLabel}>{l.type ? l.type.charAt(0).toUpperCase() + l.type.slice(1) : 'Link'}</span>
                  <span className={styles.metaPropValue}>
                    <a className={styles.propLink} href={l.url.startsWith('http') ? l.url : `https://${l.url}`} target="_blank" rel="noopener noreferrer">
                      <TbExternalLink size={11} /> {l.title || l.url}
                    </a>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Relationships */}
      {tab === 'relations' && (
        <div className={styles.relationsPage}>
          {relationCount === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyTitle}>No relationships</div>
              <div>Add reference or containment fields to connect entities.</div>
            </div>
          ) : (
            <>
              <div className={styles.sectionLabel}>Outgoing ({outgoing.length})</div>
              <div className={styles.relationsList}>
                {outgoing.map((r, i) => (
                  <RelationRow key={`o-${i}`} relation={r} direction="outgoing" schemas={schemas} navigate={navigate} />
                ))}
                {outgoing.length === 0 && <div className={styles.dim} style={{ padding: 8 }}>None</div>}
              </div>
              <div className={styles.sectionLabel}>Incoming ({incoming.length})</div>
              <div className={styles.relationsList}>
                {incoming.map((r, i) => (
                  <RelationRow key={`i-${i}`} relation={r} direction="incoming" schemas={schemas} navigate={navigate} />
                ))}
                {incoming.length === 0 && <div className={styles.dim} style={{ padding: 8 }}>None</div>}
              </div>
            </>
          )}
        </div>
      )}

      {/* Change history */}
      {tab === 'changes' && (
        <ChangeHistory auditLog={auditLog} loading={loadingAudit} />
      )}
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
}: {
  label: string;
  value: string;
  editing?: boolean;
  editValue?: string;
  onChange?: (v: string) => void;
  selectOptions?: string[];
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
            {selectOptions.map(o => (
              <option key={o} value={o}>{o || '—'}</option>
            ))}
          </select>
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
  navigate,
}: {
  field: SchemaField;
  value: unknown;
  editing: boolean;
  editValue: unknown;
  onChange: (v: unknown) => void;
  refLookup: RefLookup;
  referenceOptions: Record<string, EntitySummary[]>;
  navigate: NavigateFn;
}) => {
  const renderEditor = () => {
    if (field.type === 'reference' || field.type === 'containment') {
      const candidates = referenceOptions[field.schemaId] ?? [];
      return (
        <select
          className={styles.selectInline}
          value={(editValue as string) ?? ''}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">—</option>
          {candidates.map(e => (
            <option key={e._uid} value={e._uid}>{e._name || e._slug}</option>
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
            <option key={o.value} value={o.value}>{o.label}</option>
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
        <input
          type="checkbox"
          checked={!!editValue}
          onChange={e => onChange(e.target.checked)}
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
    if (value == null || value === '') return <span className={styles.dim}>—</span>;
    if (field.type === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
    if (field.type === 'select') {
      const opt = field.options.find(o => o.value === value);
      return <Chip tone="ghost">{opt?.label ?? String(value)}</Chip>;
    }
    if (field.type === 'reference' || field.type === 'containment') {
      const ids = String(value).split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length === 0) return <span className={styles.dim}>—</span>;
      return (
        <>
          {ids.map(id => {
            const ref = refLookup.get(id);
            const label = ref?._name ?? ref?._slug ?? id;
            return (
              <button
                key={id}
                type="button"
                className={styles.propLink}
                onClick={() => navigate({ view: 'entity-detail', entityId: id })}
              >
                {label}
              </button>
            );
          })}
        </>
      );
    }
    return <span>{String(value)}</span>;
  };

  const typeLabel = field.type.charAt(0).toUpperCase() + field.type.slice(1);

  return (
    <div className={styles.propRow}>
      <div className={styles.propLabel}>
        {field.name}
        <span className={styles.propType}>{typeLabel}</span>
      </div>
      <div className={styles.propValue}>
        {editing ? renderEditor() : renderDisplay()}
      </div>
    </div>
  );
};

const RelationRow = ({
  relation,
  direction,
  schemas,
  navigate,
}: {
  relation: Relation;
  direction: 'outgoing' | 'incoming';
  schemas: EntitySchema[];
  navigate: NavigateFn;
}) => {
  const targetSchemaId = direction === 'outgoing' ? relation.entitySchemaId : relation.entitySchemaId;
  const schemaIdx = schemas.findIndex(s => s.id === targetSchemaId);
  const targetSchema = schemaIdx >= 0 ? schemas[schemaIdx] : null;
  const targetColor = targetSchema ? resolveSchemaColor(targetSchema, schemaIdx) : 'var(--accent)';

  return (
    <button
      type="button"
      className={styles.relation}
      onClick={() => navigate({ view: 'entity-detail', entityId: relation.entityId })}
    >
      <Chip tone="ghost">{relation.fieldName}</Chip>
      <TbChevronRight size={10} className={styles.dim} />
      <TypeBadge color={targetColor} name={targetSchema?.name} icon={targetSchema?.icon} size={16} />
      <span className={styles.relationName}>{relation.entityName}</span>
      <span className={styles.dim}>{relation.entitySlug}</span>
    </button>
  );
};

const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const formatValue = (val: unknown) => {
  if (val == null || val === '') return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
};

const getOperationLabel = (op: string) => {
  switch (op) {
    case 'create': return 'created entity';
    case 'update': return 'updated';
    case 'delete': return 'deleted entity';
    default: return op;
  }
};

type ChangeRowData = {
  when: string;
  who: string;
  what: string;
  from: string;
  to: string;
};

const flattenAuditEntries = (entries: AuditLogEntry[]): ChangeRowData[] => {
  const rows: ChangeRowData[] = [];
  for (const entry of entries) {
    const when = formatTimestamp(entry.timestamp);
    const who = entry.user_id;

    if (entry.operation === 'create') {
      rows.push({ when, who, what: 'created entity', from: '—', to: '—' });
      continue;
    }

    if (entry.operation === 'delete') {
      rows.push({ when, who, what: 'deleted entity', from: '—', to: '—' });
      continue;
    }

    const oldData = entry.changes.old ?? {};
    const newData = entry.changes.new ?? {};
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    let hasChanges = false;

    allKeys.forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        hasChanges = true;
        const label = key.startsWith('_') ? key.slice(1) : key;
        rows.push({
          when,
          who,
          what: `changed ${label}`,
          from: formatValue(oldData[key]),
          to: formatValue(newData[key]),
        });
      }
    });

    if (!hasChanges) {
      rows.push({ when, who, what: getOperationLabel(entry.operation), from: '—', to: '—' });
    }
  }
  return rows;
};

const ChangeRow = ({ row }: { row: ChangeRowData }) => (
  <div className={styles.changeRow}>
    <span className={styles.changeWhen}>{row.when}</span>
    <span className={styles.changeWho}>{row.who}</span>
    <span className={styles.changeWhat}>{row.what}</span>
    <span className={styles.changeFrom}>{row.from}</span>
    <TbChevronRight size={10} className={styles.dim} />
    <span className={styles.changeTo}>{row.to}</span>
  </div>
);

const ChangeHistory = ({ auditLog, loading }: { auditLog: AuditLogEntry[]; loading: boolean }) => {
  const rows = useMemo(() => flattenAuditEntries(auditLog), [auditLog]);

  if (loading) {
    return <div className={styles.loading}>Loading change history...</div>;
  }

  if (auditLog.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyTitle}>No change history yet</div>
        <div>Changes will appear here as properties are edited.</div>
      </div>
    );
  }

  return (
    <div className={styles.changesList}>
      {rows.map((row, i) => (
        <ChangeRow key={i} row={row} />
      ))}
    </div>
  );
};
