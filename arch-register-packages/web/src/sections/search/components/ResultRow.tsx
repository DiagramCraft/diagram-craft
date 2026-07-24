import { TbChevronRight, TbCode, TbDatabase, TbFolder, TbFolders, TbHome } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { DiagramMetadataPopover } from '../../../components/DiagramMetadataPopover';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type {
  EntitySearchResult,
  ProjectFileSearchResult,
  ProjectSearchResult,
  SchemaSearchResult
} from '@arch-register/api-types/searchContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { getFileContextLabel, getFileMetadataSummary, snippetAround } from '../searchScreenHelpers';
import { Hi } from './Highlight';
import styles from './ResultRow.module.css';
import sharedStyles from '../SearchScreen.module.css';

type Props = {
  row: { kind: string; id: string; data: unknown };
  q: string;
  isSelected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
};

export const ResultRow = ({
  row,
  q,
  isSelected,
  onSelect,
  onOpen,
  schemaMap,
  lifecycleStates
}: Props) => {
  if (row.kind === 'entity') {
    const e = row.data as EntitySearchResult;
    const schemaMeta = schemaMap.get(e.schemaId);
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={e.schemaName}
            icon={schemaMeta.schema.icon}
            size={22}
          />
        ) : (
          <span className={styles.rowIcon}>
            <TbDatabase size={14} />
          </span>
        )}
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              aria-label={`Search result: ${e._name ?? e._slug}`}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={e._name ?? e._slug} q={q} />
            </button>
            <Chip tone="ghost">{e.schemaName}</Chip>
            {e._lifecycle && (
              <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />
            )}
          </div>
          {e._description && (
            <div className={styles.rowSnippet}>
              <Hi s={snippetAround(e._description, q)} q={q} />
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Entities
              <span className={sharedStyles.dim}>/</span>
              <Hi s={e.schemaName} q={q} />
              <span className={sharedStyles.dim}>/</span>
              <Hi s={e._slug} q={q} />
            </span>
            {e._owner && <Chip tone="ghost">{e._owner.name}</Chip>}
            {e.matchedFields.slice(0, 3).map(f => (
              <Chip key={f} tone="ghost">
                field:{f}
              </Chip>
            ))}
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  if (row.kind === 'project') {
    const p = row.data as ProjectSearchResult;
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        <span className={styles.rowIcon}>
          <TbFolders size={14} />
        </span>
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={p.name} q={q} />
            </button>
            <StatusChip value={p.status} />
          </div>
          {p.description && (
            <div className={styles.rowSnippet}>
              <Hi s={snippetAround(p.description, q)} q={q} />
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Projects
            </span>
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  if (row.kind === 'file') {
    const f = row.data as ProjectFileSearchResult;
    const metadataSummary = getFileMetadataSummary(f, q);
    return (
      <DiagramMetadataPopover
        type="diagram"
        fallbackTitle={f.name}
        contentMetadata={f.content_metadata}
        commentCount={f.comment_count}
        unresolvedCommentCount={f.unresolved_comment_count}
      >
        <div
          className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
          onMouseEnter={onSelect}
          onClick={onSelect}
          onDoubleClick={onOpen}
        >
          <span className={styles.rowIcon}>
            <TbFolder size={14} />
          </span>
          <div className={styles.rowBody}>
            <div className={styles.rowTitle}>
              <button
                type="button"
                className={styles.rowName}
                onClick={ev => {
                  ev.stopPropagation();
                  onOpen();
                }}
              >
                <Hi s={f.content_metadata?.title ?? f.name} q={q} />
              </button>
              <Chip tone="ghost">Diagram</Chip>
            </div>
            {metadataSummary && (
              <div className={styles.rowSnippet}>
                <Hi s={metadataSummary} q={q} />
              </div>
            )}
            <div className={styles.rowMeta}>
              <span className={styles.rowPath}>
                <TbHome size={10} /> <Hi s={getFileContextLabel(f)} q={q} />
                {f.path.includes('/') && (
                  <>
                    <span className={sharedStyles.dim}>/</span>
                    {f.path.slice(0, f.path.lastIndexOf('/'))}
                  </>
                )}
              </span>
              {f.content_metadata?.keywords.slice(0, 4).map(keyword => (
                <Chip key={keyword} tone="ghost">
                  <Hi s={keyword} q={q} />
                </Chip>
              ))}
            </div>
          </div>
          <RowGo onOpen={onOpen} />
        </div>
      </DiagramMetadataPopover>
    );
  }

  if (row.kind === 'schema') {
    const s = row.data as SchemaSearchResult;
    const schemaMeta = schemaMap.get(s.schemaId);
    return (
      <div
        className={`${styles.row} ${isSelected ? styles.rowSelected : ''}`}
        onMouseEnter={onSelect}
        onClick={onSelect}
        onDoubleClick={onOpen}
      >
        {schemaMeta ? (
          <TypeBadge
            color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
            name={s.name}
            icon={schemaMeta.schema.icon}
            size={22}
          />
        ) : (
          <span className={styles.rowIcon}>
            <TbCode size={14} />
          </span>
        )}
        <div className={styles.rowBody}>
          <div className={styles.rowTitle}>
            <button
              type="button"
              className={styles.rowName}
              onClick={ev => {
                ev.stopPropagation();
                onOpen();
              }}
            >
              <Hi s={s.name} q={q} />
            </button>
            <Chip tone="ghost">{s.fieldMatches.length} field matches</Chip>
          </div>
          {s.fieldMatches.length > 0 && (
            <div className={styles.rowSnippet}>
              Fields: {s.fieldMatches.map(f => f.fieldName).join(', ')}
            </div>
          )}
          <div className={styles.rowMeta}>
            <span className={styles.rowPath}>
              <TbCode size={10} /> Data model
              <span className={sharedStyles.dim}>/</span>
              <Hi s={s.name} q={q} />
              <span className={sharedStyles.dim}>/</span>
              fields
            </span>
          </div>
        </div>
        <RowGo onOpen={onOpen} />
      </div>
    );
  }

  return null;
};

const RowGo = ({ onOpen }: { onOpen: () => void }) => (
  <button
    type="button"
    className={styles.rowGo}
    onClick={e => {
      e.stopPropagation();
      onOpen();
    }}
    title="Open"
  >
    <TbChevronRight size={12} />
  </button>
);
