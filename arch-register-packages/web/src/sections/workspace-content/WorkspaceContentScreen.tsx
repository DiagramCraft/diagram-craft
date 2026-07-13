import { useMemo, useRef, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { TbFileText, TbFolderOpen, TbPlus, TbUpload } from 'react-icons/tb';
import styles from '../projects/ProjectDetailScreen.module.css';
import { Title } from '../../components/Title';
import {
  contentDownloadUrl,
  useContentScopeOperations,
  useContentTree,
  type ContentScope
} from '../../hooks/useContentScope';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { Button } from '@diagram-craft/app-components/Button';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import {
  DiagramBrowserToolbar,
  DiagramBrowserView
} from '../../components/diagram-browser/DiagramBrowserView';
import type { WorkspaceContentSearchParams } from '../../routes/searchParams';
import { workspaceContentFolderRoute } from '../../routes/publicObjectRoutes';
import { downloadUrl } from '../../lib/browserDownload';

type WorkspaceContentScreenProps = {
  workspaceSlug: string;
  folder: string;
};

export const WorkspaceContentScreen = ({ workspaceSlug, folder }: WorkspaceContentScreenProps) => {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as WorkspaceContentSearchParams;
  const { workspace } = useWorkspaceContext();
  const scope: ContentScope = useMemo(
    () => ({ kind: 'workspace', workspaceId: workspaceSlug }),
    [workspaceSlug]
  );
  const { data } = useContentTree(scope);
  const contentOperations = useContentScopeOperations(scope);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addDiagramOpen, setAddDiagramOpen] = useState(false);
  const [addMarkdownOpen, setAddMarkdownOpen] = useState(false);
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const filter = search.contentQuery ?? '';
  const viewMode = search.contentView ?? 'grid';

  const setFilter = (value: string) => {
    const route = folder
      ? workspaceContentFolderRoute(workspaceSlug, folder)
      : { to: '/$workspaceSlug/content' as const, params: { workspaceSlug } };
    navigate({
      ...route,
      search: {
        ...search,
        contentQuery: value === '' ? undefined : value
      },
      replace: true
    });
  };

  const setViewMode = (value: 'grid' | 'list') => {
    const route = folder
      ? workspaceContentFolderRoute(workspaceSlug, folder)
      : { to: '/$workspaceSlug/content' as const, params: { workspaceSlug } };
    navigate({
      ...route,
      search: {
        ...search,
        contentView: value === 'grid' ? undefined : value
      }
    });
  };

  const handleDiagramClick = (fileId: string) => {
    navigate({
      to: '/$workspaceSlug/content/diagrams/$diagramId',
      params: { workspaceSlug, diagramId: fileId }
    });
  };

  const handleMarkdownClick = (fileId: string, mode: 'edit' | 'preview' = 'preview') => {
    navigate({
      to: '/$workspaceSlug/content/wiki/$nodeId',
      params: { workspaceSlug, nodeId: fileId },
      search: { mode }
    });
  };

  const handleDownloadClick = (path: string, name: string, originalFilename: string | null) => {
    downloadUrl(contentDownloadUrl(scope, path), originalFilename ?? name);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      contentOperations.upload.mutate({ file: f, folder: folder || null });
    }
    e.target.value = '';
  };

  // If folder is set, show that folder's files; otherwise show root files
  const folderData = folder ? data?.folders.find(f => f.path === folder) : undefined;
  const files = folder ? (folderData?.files ?? []) : (data?.rootFiles ?? []);

  const lc = filter.toLowerCase();
  const filtered = lc ? files.filter(f => f.name.toLowerCase().includes(lc)) : files;

  return (
    <div className={styles.screen}>
      <div className={styles.header}>
        <Title
          breadcrumb={[
            {
              label: 'Home',
              onClick: () => navigate({ to: '/$workspaceSlug', params: { workspaceSlug } })
            }
          ]}
          title={workspace?.name ?? workspaceSlug}
          buttons={
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <Button variant="primary" icon={<TbPlus size={12} />}>
                    New
                  </Button>
                }
              />
              <MenuButton.Menu align="end">
                <Menu.Item
                  leftSlot={<TbFolderOpen size={13} />}
                  onClick={() => setAddFolderOpen(true)}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbUpload size={13} />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => setAddDiagramOpen(true)}>
                  New diagram
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbFileText size={13} />}
                  onClick={() => setAddMarkdownOpen(true)}
                >
                  New wiki page
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          }
        />
      </div>

      <div className={styles.meta}>
        <div className={styles.metaItem}>
          <div className={styles.metaLabel}>Items</div>
          <div className={styles.metaValue}>
            <span className="mono tabular">{files.length}</span>
          </div>
        </div>
      </div>

      <DiagramBrowserToolbar
        filter={filter}
        onFilterChange={setFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <DiagramBrowserView
        hasFilter={filter.length > 0}
        viewMode={viewMode}
        listItems={filtered.map(file => ({ file, folder }))}
        gridSections={[{ key: 'workspace-content', items: filtered, showAddButton: false }].map(
          section => ({
            ...section,
            items: section.items.map(file => ({ file }))
          })
        )}
        onOpenDiagram={file => handleDiagramClick(file.id)}
        onOpenMarkdown={file => handleMarkdownClick(file.id)}
        onDownloadFile={file =>
          handleDownloadClick(file.path, file.name, file.original_filename ?? null)
        }
        emptyState={{
          title: 'No content here',
          sub: 'Diagrams and documents will appear here when added.'
        }}
        noMatchState={{ title: 'No matches', sub: `No items match "${filter}".` }}
      />

      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />

      <AddDiagramDialog
        open={addDiagramOpen}
        onClose={() => setAddDiagramOpen(false)}
        onCreated={file => {
          setAddDiagramOpen(false);
          handleDiagramClick(file.id);
        }}
        workspaceId={workspaceSlug}
        context="workspace"
        folder={folder || null}
      />

      <AddMarkdownDialog
        open={addMarkdownOpen}
        onClose={() => setAddMarkdownOpen(false)}
        onCreated={file => {
          setAddMarkdownOpen(false);
          handleMarkdownClick(file.id, 'edit');
        }}
        onCreate={name =>
          contentOperations.createMarkdown.mutateAsync({ name, folder: folder || null })
        }
        isPending={contentOperations.createMarkdown.isPending}
      />

      <ContentFolderDialog
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
        onCreated={() => setAddFolderOpen(false)}
        onSubmit={path => contentOperations.createFolder.mutateAsync(path)}
        isPending={contentOperations.createFolder.isPending}
        parentFolder={folder || undefined}
        placeholder="e.g. Architecture"
      />
    </div>
  );
};
