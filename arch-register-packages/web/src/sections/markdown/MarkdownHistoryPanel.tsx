import { useMemo } from 'react';
import { TbChevronLeft, TbChevronRight, TbRestore, TbX } from 'react-icons/tb';
import { Button } from '@diagram-craft/app-components/Button';
import { useMarkdownRevision } from '../../hooks/useMarkdownContent';
import type { MarkdownRevisionSummary } from '@arch-register/api-types/projectContract';
import type { DocumentMetadata } from '@arch-register/api-types/documentContract';
import { MdxPreview } from './preview/MdxPreview';
import { renderMarkdownPreview } from './preview/mdxRenderNode';
import { diffMarkdown } from './diff/markdownDiff';
import type { DiffRow } from './diff/markdownDiff';
import styles from './MarkdownEditorScreen.module.css';
import { formatDateTime, formatRelativeTime } from '../../utils/dateFormat';

// ── RevisionListItem ──────────────────────────────────────────────────────────

const RevisionListItem = (props: {
  revision: MarkdownRevisionSummary;
  active: boolean;
  onClick: () => void;
}) => {
  const { revision, active, onClick } = props;
  return (
    <button
      type="button"
      className={`${styles.revisionItem} ${active ? styles.revisionItemActive : ''}`}
      onClick={onClick}
    >
      <div className={styles.revisionItemHead}>
        <div className={styles.revisionTitle}>{revision.title ?? 'Untitled revision'}</div>
        <div className={styles.revisionBadges}>
          {revision.restored_from_revision_id ? (
            <span className={styles.restoreBadge}>Restore</span>
          ) : null}
          <span className={styles.revisionBadge}>v{revision.revision_number}</span>
        </div>
      </div>
      <div className={styles.revisionMeta}>
        {revision.created_by_name ?? 'Unknown author'} · {formatRelativeTime(revision.created_at)}
      </div>
      {Object.keys(revision.metadata).length > 0 && (
        <div className={styles.revisionMeta}>
          Metadata: {Object.entries(revision.metadata).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : String(value)}`).join(' · ')}
        </div>
      )}
    </button>
  );
};

// ── DiffRowView ───────────────────────────────────────────────────────────────

const DiffRowView = ({ row }: { row: DiffRow }) => {
  if (row.kind === 'unchanged') {
    return (
      <div className={`${styles.diffRow} ${styles.diffRowUnchanged}`}>
        <div className={styles.article}>{renderMarkdownPreview(row.nodes)}</div>
      </div>
    );
  }
  if (row.kind === 'added') {
    return (
      <div className={`${styles.diffRow} ${styles.diffRowAdded}`}>
        <div className={styles.diffRowMarker}>+</div>
        <div className={styles.article}>{renderMarkdownPreview(row.nodes)}</div>
      </div>
    );
  }
  if (row.kind === 'removed') {
    return (
      <div className={`${styles.diffRow} ${styles.diffRowRemoved}`}>
        <div className={styles.diffRowMarker}>−</div>
        <div className={styles.article}>{renderMarkdownPreview(row.nodes)}</div>
      </div>
    );
  }
  return (
    <div className={`${styles.diffRow} ${styles.diffRowModified}`}>
      <div className={styles.article} dangerouslySetInnerHTML={{ __html: row.inlineHtml }} />
    </div>
  );
};

const metadataValue = (value: DocumentMetadata[string] | undefined) =>
  value == null ? '—' : Array.isArray(value) ? value.join(', ') : String(value);

const metadataEqual = (left: DocumentMetadata[string] | undefined, right: DocumentMetadata[string] | undefined) =>
  JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

// ── CompareView ───────────────────────────────────────────────────────────────

const CompareView = (props: {
  workspaceSlug: string;
  nodeId: string;
  currentBody: string;
  currentMetadata: DocumentMetadata;
  revisions: MarkdownRevisionSummary[];
  selectedRevisionId: string;
  compareMode: 'to-current' | 'changes-in-version';
}) => {
  const { workspaceSlug, nodeId, currentBody, currentMetadata, revisions, selectedRevisionId, compareMode } = props;

  const selectedIndex = revisions.findIndex(r => r.id === selectedRevisionId);
  const previousRevision = revisions[selectedIndex + 1] ?? null;

  const baseRevisionId = compareMode === 'to-current' ? selectedRevisionId : previousRevision?.id;
  const targetRevisionId = compareMode === 'to-current' ? undefined : selectedRevisionId;

  const { data: baseRevision, isLoading: baseLoading } = useMarkdownRevision(
    workspaceSlug,
    nodeId,
    baseRevisionId
  );
  const { data: targetRevision, isLoading: targetLoading } = useMarkdownRevision(
    workspaceSlug,
    nodeId,
    targetRevisionId
  );

  const baseBody = baseRevision?.body ?? null;
  const targetBody = compareMode === 'to-current' ? currentBody : (targetRevision?.body ?? null);
  const baseMetadata = baseRevision?.metadata ?? null;
  const targetMetadata = compareMode === 'to-current' ? currentMetadata : (targetRevision?.metadata ?? null);

  const rows = useMemo(() => {
    if (baseBody === null) return null;
    return diffMarkdown(baseBody, targetBody ?? '');
  }, [baseBody, targetBody]);

  const metadataChanges = useMemo(() => {
    if (baseMetadata === null || targetMetadata === null) return null;
    const keys = new Set([...Object.keys(baseMetadata), ...Object.keys(targetMetadata)]);
    return [...keys]
      .sort()
      .filter(key => !metadataEqual(baseMetadata[key], targetMetadata[key]))
      .map(key => ({ key, previous: baseMetadata[key], next: targetMetadata[key] }));
  }, [baseMetadata, targetMetadata]);

  const isLoading = baseLoading || (compareMode === 'changes-in-version' && targetLoading);
  const noPreviousVersion = compareMode === 'changes-in-version' && !previousRevision;

  return (
    <div className={styles.compareView}>
      <div className={styles.compareBody}>
        {noPreviousVersion ? (
          <div className={styles.previewEmpty}>
            This is the first version — no previous version to compare against.
          </div>
        ) : isLoading || rows === null ? (
          <div className={styles.previewEmpty}>Loading…</div>
        ) : rows.length === 0 && metadataChanges?.length === 0 ? (
          <div className={styles.previewEmpty}>These versions are identical.</div>
        ) : (
          <>
            {metadataChanges && metadataChanges.length > 0 && (
              <section style={{ padding: '12px 16px', borderBottom: '1px solid var(--panel-border)' }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Metadata changes</div>
                <div style={{ display: 'grid', gap: 4, fontSize: 11 }}>
                  {metadataChanges.map(change => (
                    <div key={change.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr', gap: 8 }}>
                      <code>{change.key}</code>
                      <span style={{ color: 'var(--error-fg)' }}>− {metadataValue(change.previous)}</span>
                      <span style={{ color: 'var(--success-fg)' }}>+ {metadataValue(change.next)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {rows.map((row, i) => <DiffRowView key={i} row={row} />)}
          </>
        )}
      </div>
    </div>
  );
};

// ── MarkdownHistoryPanel ──────────────────────────────────────────────────────

type MarkdownHistoryPanelProps = {
  workspaceSlug: string;
  nodeId: string;
  currentBody: string;
  currentMetadata: DocumentMetadata;
  revisions: MarkdownRevisionSummary[];
  revisionsLoading: boolean;
  selectedRevisionId: string | undefined;
  historyMode: 'preview' | 'compare';
  compareMode: 'to-current' | 'changes-in-version';
  isRestoring: boolean;
  onSelectRevision: (revisionId: string) => void;
  onViewVersion: () => void;
  onEnterCompare: (mode: 'to-current' | 'changes-in-version') => void;
  onRestore: (revisionId: string) => void;
  onClose: () => void;
};

export const MarkdownHistoryPanel = ({
  workspaceSlug,
  nodeId,
  currentBody,
  currentMetadata,
  revisions,
  revisionsLoading,
  selectedRevisionId,
  historyMode,
  compareMode,
  isRestoring,
  onSelectRevision,
  onViewVersion,
  onEnterCompare,
  onRestore,
  onClose
}: MarkdownHistoryPanelProps) => {
  const selectedRevisionSummary = useMemo(
    () => revisions.find(r => r.id === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId]
  );

  const { data: selectedRevision, isLoading: revisionLoading } = useMarkdownRevision(
    workspaceSlug,
    nodeId,
    selectedRevisionSummary?.id
  );

  return (
    <>
      <div className={styles.toolbar}>
        <div className={styles.paneToggle}>
          <button
            type="button"
            className={`${styles.paneToggleBtn} ${historyMode === 'preview' ? styles.paneToggleBtnActive : ''}`}
            disabled={!selectedRevisionSummary}
            onClick={onViewVersion}
          >
            Version
          </button>
          <button
            type="button"
            className={`${styles.paneToggleBtn} ${historyMode === 'compare' && compareMode === 'changes-in-version' ? styles.paneToggleBtnActive : ''}`}
            disabled={!selectedRevisionSummary}
            onClick={() => onEnterCompare('changes-in-version')}
          >
            Diff
          </button>
          <button
            type="button"
            className={`${styles.paneToggleBtn} ${historyMode === 'compare' && compareMode === 'to-current' ? styles.paneToggleBtnActive : ''}`}
            disabled={!selectedRevisionSummary}
            onClick={() => onEnterCompare('to-current')}
          >
            vs Current
          </button>
        </div>

        <div className={styles.toolbarNavGroup}>
          {selectedRevisionSummary ? (
            <span className={styles.toolbarMeta}>
              v{selectedRevisionSummary.revision_number}
              {' · '}
              {selectedRevisionSummary.created_by_name ?? 'Unknown author'}
              {' · '}
              {formatDateTime(selectedRevisionSummary.created_at)}
            </span>
          ) : (
            <span className={styles.toolbarMeta}>No version selected</span>
          )}
        </div>

        <div className={styles.toolbarActions}>
          <Button
            variant="secondary"
            icon={<TbChevronLeft size={14} />}
            disabled={
              !selectedRevisionSummary ||
              revisions.indexOf(selectedRevisionSummary) === revisions.length - 1
            }
            onClick={() => {
              const idx = revisions.indexOf(selectedRevisionSummary!);
              onSelectRevision(revisions[idx + 1]!.id);
            }}
          />
          <Button
            variant="secondary"
            icon={<TbChevronRight size={14} />}
            disabled={!selectedRevisionSummary || revisions.indexOf(selectedRevisionSummary) === 0}
            onClick={() => {
              const idx = revisions.indexOf(selectedRevisionSummary!);
              onSelectRevision(revisions[idx - 1]!.id);
            }}
          />
          <Button
            variant="secondary"
            icon={<TbRestore size={13} />}
            disabled={!selectedRevisionSummary || isRestoring}
            onClick={() => selectedRevisionSummary && onRestore(selectedRevisionSummary.id)}
          >
            Restore
          </Button>
          <Button variant="secondary" icon={<TbX size={13} />} onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <div className={styles.historyGrid}>
        <section className={styles.historyPreview}>
          {historyMode === 'compare' && selectedRevisionId ? (
            <CompareView
              workspaceSlug={workspaceSlug}
              nodeId={nodeId}
              currentBody={currentBody}
              currentMetadata={currentMetadata}
              revisions={revisions}
              selectedRevisionId={selectedRevisionId}
              compareMode={compareMode}
            />
          ) : revisionLoading ? (
            <div className={styles.previewEmpty}>Loading selected version…</div>
          ) : selectedRevision ? (
            <article className={styles.article}>
              {(selectedRevision.body ?? '').trim() ? (
                <>
                  <MdxPreview body={selectedRevision.body ?? ''} withoutFirstHeading />
                  <div className={styles.articleFooter}>
                    Saved {formatDateTime(selectedRevision.created_at)}
                  </div>
                  {Object.keys(selectedRevision.metadata).length > 0 && (
                    <div className={styles.articleFooter}>
                      Metadata: {Object.entries(selectedRevision.metadata).map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(', ') : String(value)}`).join(' · ')}
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.previewEmpty}>This revision is empty.</div>
              )}
            </article>
          ) : (
            <div className={styles.previewEmpty}>Select a version to preview it here.</div>
          )}
        </section>

        <aside className={styles.historySidebar}>
          <div className={styles.historySidebarBody}>
            {revisionsLoading ? (
              <div className={styles.previewEmpty}>Loading versions…</div>
            ) : revisions.length === 0 ? (
              <div className={styles.previewEmpty}>
                No saved versions yet. Save this document to start a history.
              </div>
            ) : (
              revisions.map(revision => (
                <RevisionListItem
                  key={revision.id}
                  revision={revision}
                  active={revision.id === selectedRevisionSummary?.id}
                  onClick={() => onSelectRevision(revision.id)}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </>
  );
};
