import { TbArrowRight, TbCode, TbDatabase, TbFolder, TbFolders } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { getFileContextLabel, getFileFolder, type SearchPreview } from '../searchScreenHelpers';
import { Hi } from './Highlight';
import styles from './PreviewPane.module.css';
import sharedStyles from '../SearchScreen.module.css';

type Props = {
  preview: SearchPreview | null;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  onEntityClick: (entityId: string) => void;
  onProjectClick: (projectId: string) => void;
  onProjectFolderClick: (projectId: string, folder: string | null) => void;
  onEntityFolderClick: (entityId: string, folder: string | null) => void;
  onWorkspaceFolderClick: (folder: string | null) => void;
  onSchemaClick: (schemaId: string) => void;
  q: string;
  lifecycleStates: WorkspaceLifecycleState[];
};

export const PreviewPane = ({
  preview,
  schemaMap,
  onEntityClick,
  onProjectClick,
  onProjectFolderClick,
  onEntityFolderClick,
  onWorkspaceFolderClick,
  onSchemaClick,
  q,
  lifecycleStates
}: Props) => {
  if (!preview) {
    return (
      <div className={styles.previewEmpty}>
        Hover or use <kbd className={sharedStyles.kbd}>↑</kbd>
        <kbd className={sharedStyles.kbd}>↓</kbd> to preview a result.
      </div>
    );
  }

  if (preview.type === 'entity') {
    const e = preview.data;
    const schemaMeta = schemaMap.get(e.schemaId);
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          {schemaMeta ? (
            <TypeBadge
              color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
              name={e.schemaName}
              icon={schemaMeta.schema.icon}
              size={28}
            />
          ) : (
            <span className={styles.previewIcon}>
              <TbDatabase size={16} />
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>{e.schemaName}</div>
            <div className={styles.previewTitle}>
              <Hi s={e._name ?? e._slug} q={q} />
            </div>
          </div>
          {e._lifecycle && <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />}
        </div>
        {e._description && (
          <div className={styles.previewDesc}>
            <Hi s={e._description} q={q} />
          </div>
        )}
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={e._name} q={q} />
          </dd>
          <dt>Slug</dt>
          <dd className={styles.mono}>
            <Hi s={e._slug} q={q} />
          </dd>
          <dt>Schema</dt>
          <dd>
            <Hi s={e.schemaName} q={q} />
          </dd>
          <dt>Owner</dt>
          <dd>
            <Hi s={e._owner?.name ?? '—'} q={q} />
          </dd>
          <dt>Lifecycle</dt>
          <dd>
            <Hi s={e._lifecycle?.name ?? '—'} q={q} />
          </dd>
        </dl>
        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => onEntityClick(e.publicId)}
          >
            Open entity <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (preview.type === 'project') {
    const p = preview.data;
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          <span className={styles.previewIcon}>
            <TbFolders size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>Project</div>
            <div className={styles.previewTitle}>
              <Hi s={p.name} q={q} />
            </div>
          </div>
          <StatusChip value={p.status} />
        </div>
        {p.description && (
          <div className={styles.previewDesc}>
            <Hi s={p.description} q={q} />
          </div>
        )}
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={p.name} q={q} />
          </dd>
          <dt>Status</dt>
          <dd>
            <Hi s={p.status} q={q} />
          </dd>
          {p.description && (
            <>
              <dt>Description</dt>
              <dd>
                <Hi s={p.description} q={q} />
              </dd>
            </>
          )}
        </dl>
        <div className={styles.previewActions}>
          <button type="button" className={styles.previewBtn} onClick={() => onProjectClick(p.id)}>
            Open project <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  if (preview.type === 'file') {
    const f = preview.data;
    const folder = getFileFolder(f.path);
    const locationLabel =
      f.scope === 'project' ? 'Project' : f.scope === 'entity' ? 'Entity' : 'Workspace';
    return (
      <div className={styles.previewBody}>
        <div className={styles.previewHead}>
          <span className={styles.previewIcon}>
            <TbFolder size={14} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={styles.previewEyebrow}>Diagram</div>
            <div className={styles.previewTitle}>
              <Hi s={f.name} q={q} />
            </div>
          </div>
        </div>
        <dl className={styles.previewProps}>
          <dt>Name</dt>
          <dd>
            <Hi s={f.name} q={q} />
          </dd>
          {f.content_metadata?.title && (
            <>
              <dt>Metadata title</dt>
              <dd>
                <Hi s={f.content_metadata.title} q={q} />
              </dd>
            </>
          )}
          <dt>{locationLabel}</dt>
          <dd>
            <Hi s={getFileContextLabel(f)} q={q} />
          </dd>
          <dt>Folder</dt>
          <dd>
            <Hi s={folder} q={q} />
          </dd>
          <dt>Path</dt>
          <dd className={styles.mono}>
            <Hi s={f.path} q={q} />
          </dd>
          {f.content_metadata?.description && (
            <>
              <dt>Description</dt>
              <dd>
                <Hi s={f.content_metadata.description} q={q} />
              </dd>
            </>
          )}
          {f.content_metadata?.category && (
            <>
              <dt>Category</dt>
              <dd>
                <Hi s={f.content_metadata.category} q={q} />
              </dd>
            </>
          )}
          {f.content_metadata?.keywords.length ? (
            <>
              <dt>Keywords</dt>
              <dd className={styles.tags}>
                {f.content_metadata.keywords.map(keyword => (
                  <Chip key={keyword} tone="ghost">
                    <Hi s={keyword} q={q} />
                  </Chip>
                ))}
              </dd>
            </>
          ) : null}
        </dl>
        <div className={styles.previewActions}>
          <button
            type="button"
            className={styles.previewBtn}
            onClick={() => {
              if (f.scope === 'project' && f.projectId) {
                onProjectFolderClick(f.projectId!, f.path.includes('/') ? folder : null);
                return;
              }
              if (f.scope === 'entity' && f.entityPublicId) {
                onEntityFolderClick(f.entityPublicId, f.path.includes('/') ? folder : null);
                return;
              }
              if (f.scope === 'workspace') {
                onWorkspaceFolderClick(f.path.includes('/') ? folder : null);
              }
            }}
          >
            Open{' '}
            {f.scope === 'project' ? 'in project' : f.scope === 'entity' ? 'entity' : 'workspace'}{' '}
            <TbArrowRight size={11} />
          </button>
        </div>
      </div>
    );
  }

  // schema
  const s = preview.data;
  const schemaMeta = schemaMap.get(s.schemaId);
  const allFields = schemaMeta?.schema.fields ?? [];
  return (
    <div className={styles.previewBody}>
      <div className={styles.previewHead}>
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={s.name}
            icon={schemaMeta.schema.icon}
            size={28}
          />
        ) : (
          <span className={styles.previewIcon}>
            <TbCode size={14} />
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.previewEyebrow}>Schema</div>
          <div className={styles.previewTitle}>
            <Hi s={s.name} q={q} />
          </div>
        </div>
      </div>
      <dl className={styles.previewProps}>
        <dt>Name</dt>
        <dd>
          <Hi s={s.name} q={q} />
        </dd>
        <dt>Fields</dt>
        <dd>{allFields.length}</dd>
      </dl>
      {allFields.length > 0 && (
        <>
          <div className={styles.sectionLabel}>Fields</div>
          <div className={styles.fieldList}>
            {allFields.map(f => (
              <div key={f.id} className={styles.fieldRow}>
                <span className={styles.fieldName}>
                  <Hi s={f.name} q={q} />
                </span>
                <span className={styles.fieldId}>
                  <Hi s={f.id} q={q} />
                </span>
                <span className={styles.fieldType}>{f.type}</span>
              </div>
            ))}
          </div>
        </>
      )}
      <div className={styles.previewActions}>
        <button
          type="button"
          className={styles.previewBtn}
          onClick={() => onSchemaClick(s.schemaId)}
        >
          Open in data model <TbArrowRight size={11} />
        </button>
      </div>
    </div>
  );
};
