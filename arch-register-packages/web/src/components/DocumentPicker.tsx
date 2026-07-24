import { useMemo, useState } from 'react';
import type { DocumentListItem, ProjectFile } from '@arch-register/api-types/projectContract';
import { Dialog } from '@diagram-craft/app-components/Dialog';
import { Autocomplete } from '@diagram-craft/app-components/Autocomplete';
import { TbFileText, TbFolder, TbFolderOpen } from 'react-icons/tb';
import {
  useDocumentList,
  useDocumentPickerSearch,
  type DocumentScope
} from '../hooks/useDocuments';
import { useContentTree, type ContentScope } from '../hooks/useContentScope';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { buildContentFolderTree, type ContentFolderNode } from '../lib/contentPath';
import { TreeRow } from './TreeRow';
import styles from './DocumentPicker.module.css';

export type DocumentPickerTreeScope = {
  scope: ContentScope;
  label?: string;
};

type SelectedDocument = { name: string } | null | undefined;

const ALL_SCOPES: readonly DocumentScope[] = ['workspace', 'project', 'entity'];

const scopeLabel = (scope: DocumentScope) => {
  if (scope === 'project') return 'Project document';
  if (scope === 'entity') return 'Entity document';
  return 'Workspace document';
};

const asTreeDocument = (file: ProjectFile, scope: DocumentScope): DocumentListItem => ({
  file,
  scope,
  document_type_id: null,
  document_type_name: null,
  document_type_color: null,
  document_type_icon: file.document_type_icon ?? null,
  metadata: {}
});

const TreeFile = ({
  file,
  selectedDocumentId,
  onSelect
}: {
  file: ProjectFile;
  selectedDocumentId: string;
  onSelect: (file: ProjectFile) => void;
}) => (
  <TreeRow
    label={file.name}
    icon={<TbFileText size={13} />}
    active={file.id === selectedDocumentId}
    onClick={() => onSelect(file)}
  />
);

const PickerFolder = ({
  node,
  depth,
  expanded,
  onToggle,
  selectedDocumentId,
  onSelect,
  isAllowed
}: {
  node: ContentFolderNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  selectedDocumentId: string;
  onSelect: (file: ProjectFile) => void;
  isAllowed: (file: ProjectFile) => boolean;
}) => {
  const open = expanded.has(node.path);
  const markdownFiles = node.files.filter(isAllowed);

  return (
    <div>
      <TreeRow
        label={node.name}
        icon={open ? <TbFolderOpen size={13} /> : <TbFolder size={13} />}
        depth={depth}
        expandable
        expanded={open}
        onExpand={() => onToggle(node.path)}
        onClick={() => onToggle(node.path)}
      />
      {open && (
        <>
          {markdownFiles.map(file => (
            <div key={file.id} style={{ paddingLeft: 12 }}>
              <TreeFile file={file} selectedDocumentId={selectedDocumentId} onSelect={onSelect} />
            </div>
          ))}
          {node.children.map(child => (
            <PickerFolder
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              selectedDocumentId={selectedDocumentId}
              onSelect={onSelect}
              isAllowed={isAllowed}
            />
          ))}
        </>
      )}
    </div>
  );
};

const PickerTreeScope = ({
  descriptor,
  documentTypeId,
  selectedDocumentId,
  onSelect,
  enabled
}: {
  descriptor: DocumentPickerTreeScope;
  documentTypeId?: string;
  selectedDocumentId: string;
  onSelect: (document: DocumentListItem) => void;
  enabled: boolean;
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { data } = useContentTree(descriptor.scope, { enabled });
  const { data: typedDocuments = [], isLoading: typedDocumentsLoading } = useDocumentList(
    descriptor.scope.workspaceId,
    {
      scope: descriptor.scope.kind,
      projectId: descriptor.scope.kind === 'project' ? descriptor.scope.projectId : undefined,
      entityId: descriptor.scope.kind === 'entity' ? descriptor.scope.entityId : undefined,
      documentTypeId,
      limit: 100
    },
    { enabled: enabled && !!documentTypeId }
  );

  const documentsById = useMemo(
    () => new Map(typedDocuments.map(document => [document.file.id, document])),
    [typedDocuments]
  );
  const tree = useMemo(() => buildContentFolderTree(data?.folders ?? []), [data?.folders]);
  const isAllowed = (file: ProjectFile) =>
    file.type === 'markdown' && (!documentTypeId || documentsById.has(file.id));
  const selectFile = (file: ProjectFile) => {
    if (!isAllowed(file)) return;
    onSelect(documentsById.get(file.id) ?? asTreeDocument(file, descriptor.scope.kind));
  };
  const toggle = (path: string) =>
    setExpanded(previous => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  const hasAllowedFiles = (node: ContentFolderNode): boolean =>
    node.files.some(isAllowed) || node.children.some(hasAllowedFiles);

  if (typedDocumentsLoading) return <div className={styles.pickerHint}>Loading documents…</div>;

  return (
    <div className={styles.treeScope}>
      <div className={styles.treeScopeTitle}>
        {descriptor.label ?? scopeLabel(descriptor.scope.kind)}
      </div>
      {!data && <div className={styles.pickerHint}>Loading content…</div>}
      {data && (
        <div className={styles.tree}>
          {data.rootFiles.filter(isAllowed).map(file => (
            <TreeFile
              key={file.id}
              file={file}
              selectedDocumentId={selectedDocumentId}
              onSelect={selectFile}
            />
          ))}
          {tree
            .filter(node => hasAllowedFiles(node))
            .map(node => (
              <PickerFolder
                key={node.path}
                node={node}
                depth={0}
                expanded={expanded}
                onToggle={toggle}
                selectedDocumentId={selectedDocumentId}
                onSelect={selectFile}
                isAllowed={isAllowed}
              />
            ))}
          {data.rootFiles.filter(isAllowed).length === 0 &&
            tree.every(node => !hasAllowedFiles(node)) && (
              <div className={styles.pickerHint}>No documents found</div>
            )}
        </div>
      )}
    </div>
  );
};

export const DocumentPicker = ({
  selectedDocumentId,
  selectedDocument,
  onSelectDocument,
  onClearDocument,
  documentTypeId,
  limit,
  allowedScopes = ALL_SCOPES,
  treeScopes = [],
  browse = {}
}: {
  selectedDocumentId: string;
  selectedDocument?: SelectedDocument;
  onSelectDocument: (document: DocumentListItem) => void;
  onClearDocument: () => void;
  documentTypeId?: string;
  limit?: number;
  allowedScopes?: readonly DocumentScope[];
  treeScopes?: readonly DocumentPickerTreeScope[];
  browse?: false | { label?: string; title?: string };
}) => {
  const { workspaceSlug } = useWorkspaceContext();
  const [query, setQuery] = useState('');
  const [browseOpen, setBrowseOpen] = useState(false);
  const {
    data: searchResults = [],
    isLoading: searchLoading,
    isError: searchError
  } = useDocumentPickerSearch(
    workspaceSlug,
    { q: query, documentTypeId, allowedScopes, limit },
    { enabled: !!query.trim() }
  );

  const visibleTreeScopes = treeScopes.filter(descriptor =>
    allowedScopes.includes(descriptor.scope.kind)
  );
  const browseConfig = browse === false ? null : browse;
  const canBrowse = !!browseConfig && visibleTreeScopes.length > 0;

  return (
    <>
      {selectedDocumentId && selectedDocument && !query && (
        <div className={styles.selectedChip}>
          <span className={styles.pickerName}>{selectedDocument.name}</span>
          <button type="button" className={styles.chipClear} onClick={onClearDocument}>
            ×
          </button>
        </div>
      )}
      <div className={styles.inputRow}>
        <Autocomplete
          items={searchResults}
          value={query}
          onValueChange={setQuery}
          onSelect={document => {
            onSelectDocument(document);
            setQuery('');
          }}
          getItemKey={document => document.file.id}
          getItemLabel={document => document.file.name}
          placeholder={selectedDocumentId ? 'Search to change document…' : 'Search for a document…'}
          ariaLabel={selectedDocumentId ? 'Search to change document' : 'Search for a document'}
          emptyMessage="No documents found"
          loading={!!query.trim() && searchLoading}
          errorMessage={query.trim() && searchError ? 'Unable to search documents' : undefined}
          autoFocus
          inputClassName={styles.pickerInput}
          renderItem={document => (
            <>
              <span className={styles.pickerName}>{document.file.name}</span>
              <span className={styles.pickerSchema}>{scopeLabel(document.scope)}</span>
            </>
          )}
        />
        {canBrowse && (
          <button type="button" className={styles.browseButton} onClick={() => setBrowseOpen(true)}>
            {browseConfig?.label ?? 'Browse'}
          </button>
        )}
      </div>
      {canBrowse && (
        <Dialog
          open={browseOpen}
          onClose={() => setBrowseOpen(false)}
          title={browseConfig?.title ?? 'Browse documents'}
          width={520}
          buttons={[{ label: 'Cancel', type: 'cancel', onClick: () => setBrowseOpen(false) }]}
        >
          <div className={styles.treeDialog}>
            {visibleTreeScopes.map((descriptor, index) => (
              <PickerTreeScope
                key={`${descriptor.scope.kind}-${descriptor.scope.kind === 'project' ? descriptor.scope.projectId : descriptor.scope.kind === 'entity' ? descriptor.scope.entityId : descriptor.scope.workspaceId}-${index}`}
                descriptor={descriptor}
                documentTypeId={documentTypeId}
                selectedDocumentId={selectedDocumentId}
                enabled={browseOpen}
                onSelect={document => {
                  onSelectDocument(document);
                  setBrowseOpen(false);
                }}
              />
            ))}
          </div>
        </Dialog>
      )}
    </>
  );
};
