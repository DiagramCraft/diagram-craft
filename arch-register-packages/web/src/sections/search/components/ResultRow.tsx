import type { ReactNode } from 'react';
import { TbArrowsRightLeft, TbCode, TbDatabase, TbFolder, TbFolders, TbHome } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { StatusChip } from '../../../components/StatusChip';
import { DiagramMetadataPopover } from '../../../components/DiagramMetadataPopover';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type {
  EntitySearchResult,
  ProjectFileSearchResult,
  ProjectSearchResult,
  RelationSearchResult,
  SchemaSearchResult
} from '@arch-register/api-types/searchContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { getFileContextLabel, getFileMetadataSummary, snippetAround } from '../searchScreenHelpers';
import { Hi } from './Highlight';
import styles from './ResultRow.module.css';

type Props = {
  row: { kind: string; id: string; data: unknown };
  q: string;
  onOpen: () => void;
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  lifecycleStates: WorkspaceLifecycleState[];
};

type ShellProps = {
  icon: ReactNode;
  title: ReactNode;
  ariaLabel?: string;
  chips?: ReactNode;
  snippet?: ReactNode;
  meta: ReactNode;
  onOpen: () => void;
};

const ResultRowShell = ({ icon, title, ariaLabel, chips, snippet, meta, onOpen }: ShellProps) => (
  <div className={styles.row} onClick={onOpen}>
    {icon}
    <div className={styles.rowBody}>
      <div className={styles.rowTitle}>
        <button type="button" className={styles.rowName} aria-label={ariaLabel}>
          {title}
        </button>
        {chips}
      </div>
      {snippet && <div className={styles.rowSnippet}>{snippet}</div>}
      <div className={styles.rowMeta}>{meta}</div>
    </div>
  </div>
);

const Slash = () => <span className={styles.dim}>/</span>;

const FieldChips = ({ fields }: { fields: string[] }) =>
  fields.slice(0, 3).map(f => (
    <Chip key={f} tone="ghost">
      field:{f}
    </Chip>
  ));

const PlainIcon = ({ children }: { children: ReactNode }) => (
  <span className={styles.rowIcon}>{children}</span>
);

export const ResultRow = ({ row, q, onOpen, schemaMap, lifecycleStates }: Props) => {
  if (row.kind === 'entity') {
    const e = row.data as EntitySearchResult;
    const schemaMeta = schemaMap.get(e.schemaId);
    return (
      <ResultRowShell
        onOpen={onOpen}
        icon={
          schemaMeta ? (
            <TypeBadge
              color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
              name={e.schemaName}
              icon={schemaMeta.schema.icon}
              size={22}
            />
          ) : (
            <PlainIcon>
              <TbDatabase size={14} />
            </PlainIcon>
          )
        }
        ariaLabel={`Search result: ${e._name ?? e._slug}`}
        title={<Hi s={e._name ?? e._slug} q={q} />}
        chips={
          <>
            <Chip tone="ghost">{e.schemaName}</Chip>
            {e._lifecycle && (
              <StatusChip value={e._lifecycle.id} lifecycleStates={lifecycleStates} />
            )}
          </>
        }
        snippet={e._description && <Hi s={snippetAround(e._description, q)} q={q} />}
        meta={
          <>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Entities
              <Slash />
              <Hi s={e.schemaName} q={q} />
              <Slash />
              <Hi s={e._slug} q={q} />
            </span>
            {e._owner && <Chip tone="ghost">{e._owner.name}</Chip>}
            <FieldChips fields={e.matchedFields} />
          </>
        }
      />
    );
  }

  if (row.kind === 'project') {
    const p = row.data as ProjectSearchResult;
    return (
      <ResultRowShell
        onOpen={onOpen}
        icon={
          <PlainIcon>
            <TbFolders size={14} />
          </PlainIcon>
        }
        title={<Hi s={p.name} q={q} />}
        chips={<StatusChip value={p.status} />}
        snippet={p.description && <Hi s={snippetAround(p.description, q)} q={q} />}
        meta={
          <span className={styles.rowPath}>
            <TbHome size={10} /> Projects
          </span>
        }
      />
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
        <ResultRowShell
          onOpen={onOpen}
          icon={
            <PlainIcon>
              <TbFolder size={14} />
            </PlainIcon>
          }
          title={<Hi s={f.content_metadata?.title ?? f.name} q={q} />}
          chips={<Chip tone="ghost">Diagram</Chip>}
          snippet={metadataSummary && <Hi s={metadataSummary} q={q} />}
          meta={
            <>
              <span className={styles.rowPath}>
                <TbHome size={10} /> <Hi s={getFileContextLabel(f)} q={q} />
                {f.path.includes('/') && (
                  <>
                    <Slash />
                    {f.path.slice(0, f.path.lastIndexOf('/'))}
                  </>
                )}
              </span>
              {f.content_metadata?.keywords.slice(0, 4).map(keyword => (
                <Chip key={keyword} tone="ghost">
                  <Hi s={keyword} q={q} />
                </Chip>
              ))}
            </>
          }
        />
      </DiagramMetadataPopover>
    );
  }

  if (row.kind === 'schema') {
    const s = row.data as SchemaSearchResult;
    const schemaMeta = schemaMap.get(s.schemaId);
    return (
      <ResultRowShell
        onOpen={onOpen}
        icon={
          schemaMeta ? (
            <TypeBadge
              color={resolveSchemaColor(schemaMeta.schema, schemaMeta.index)}
              name={s.name}
              icon={schemaMeta.schema.icon}
              size={22}
            />
          ) : (
            <PlainIcon>
              <TbCode size={14} />
            </PlainIcon>
          )
        }
        title={<Hi s={s.name} q={q} />}
        chips={<Chip tone="ghost">{s.fieldMatches.length} field matches</Chip>}
        snippet={
          s.fieldMatches.length > 0 && (
            <>Fields: {s.fieldMatches.map(f => f.fieldName).join(', ')}</>
          )
        }
        meta={
          <span className={styles.rowPath}>
            <TbCode size={10} /> Data model
            <Slash />
            <Hi s={s.name} q={q} />
            <Slash />
            fields
          </span>
        }
      />
    );
  }

  if (row.kind === 'relation') {
    const r = row.data as RelationSearchResult;
    return (
      <ResultRowShell
        onOpen={onOpen}
        icon={
          <PlainIcon>
            <TbArrowsRightLeft size={14} />
          </PlainIcon>
        }
        ariaLabel={`Search result: ${r.schemaName}`}
        title={
          <>
            <Hi s={r.inEntityName} q={q} /> → <Hi s={r.outEntityName} q={q} />
          </>
        }
        chips={<Chip tone="ghost">{r.schemaName}</Chip>}
        meta={
          <>
            <span className={styles.rowPath}>
              <TbHome size={10} /> Relations
              <Slash />
              <Hi s={r.schemaName} q={q} />
            </span>
            <FieldChips fields={r.matchedFields} />
          </>
        }
      />
    );
  }

  return null;
};
