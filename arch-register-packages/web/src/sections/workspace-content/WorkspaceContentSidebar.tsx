import { useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { DeleteConfirmationDialog } from '@diagram-craft/app-components/DeleteConfirmationDialog';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import {
  TbFileText,
  TbFolderOpen,
  TbGitBranch,
  TbHome,
  TbPencil,
  TbPlus,
  TbRefresh,
  TbTrash,
  TbUpload,
  TbInfoCircle
} from 'react-icons/tb';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { ContentTree, type ContentTreeHandle } from '../../components/ContentTree';
import { ExternalContentStatusDialog } from '../../components/ExternalContentStatusDialog';
import { TreeRow } from '../../components/TreeRow';
import { MountExternalContentDialog } from '../../components/MountExternalContentDialog';
import {
  contentDownloadUrl,
  useContentScopeOperations,
  useContentTree,
  type ContentScope
} from '../../hooks/useContentScope';
import {
  useExternalContentMounts,
  useExternalContentOperations
} from '../../hooks/useExternalContent';
import type { ExternalContentMount } from '@arch-register/api-types/externalContentContract';
import { workspaceContentFolderRoute } from '../../routes/publicObjectRoutes';
import type { WorkspaceContentSearchParams } from '../../routes/searchParams';
import styles from '../../shell/SidePanel.module.css';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import { downloadUrl } from '../../lib/browserDownload';
import { ApiError } from '../../lib/http';

export const WorkspaceContentSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const scope: ContentScope = { kind: 'workspace', workspaceId: workspaceSlug };
  const { data } = useContentTree(scope);
  const operations = useContentScopeOperations(scope);
  const treeRef = useRef<ContentTreeHandle>(null);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parent: string | null }>({
    open: false,
    parent: null
  });
  const [diagramFolder, setDiagramFolder] = useState<string | null | undefined>(undefined);
  const [markdownFolder, setMarkdownFolder] = useState<string | null | undefined>(undefined);
  const [mountDialogOpen, setMountDialogOpen] = useState(false);
  const [mountMenu, setMountMenu] = useState<{ x: number; y: number; mountId: string } | null>(
    null
  );
  const [editMount, setEditMount] = useState<ExternalContentMount | null>(null);
  const [statusMount, setStatusMount] = useState<ExternalContentMount | null>(null);
  const [deleteMount, setDeleteMount] = useState<ExternalContentMount | null>(null);
  const [mountActionError, setMountActionError] = useState('');
  const mounts = useExternalContentMounts(workspaceSlug, !!mountMenu);
  const externalOperations = useExternalContentOperations(workspaceSlug);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as WorkspaceContentSearchParams;
  const contentFolder = params._splat ?? null;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;
  const activeFolderData = contentFolder
    ? data?.folders.find(folder => folder.path === contentFolder)
    : undefined;
  const selectedMount = mounts.data?.find(mount => mount.id === mountMenu?.mountId) ?? null;

  const navigateHome = (folder?: string) => {
    const nextSearch = { contentQuery: search.contentQuery, contentView: search.contentView };
    if (folder) {
      navigate(workspaceContentFolderRoute(workspaceSlug, folder, nextSearch));
    } else {
      navigate({ to: '/$workspaceSlug/content', params: { workspaceSlug }, search: nextSearch });
    }
  };
  const download = (file: ProjectFile) => {
    downloadUrl(contentDownloadUrl(scope, file.path), file.original_filename ?? file.name);
  };

  const removeMount = async () => {
    if (!deleteMount) return;
    try {
      await externalOperations.remove.mutateAsync(deleteMount.id);
      if (
        contentFolder === deleteMount.destination_path ||
        contentFolder?.startsWith(`${deleteMount.destination_path}/`)
      ) {
        navigateHome();
      }
    } catch (caught) {
      setMountActionError(
        caught instanceof ApiError ? caught.message : 'Unable to remove content mount'
      );
    } finally {
      setDeleteMount(null);
    }
  };

  return (
    <>
      <div className={`${styles.header} ${styles.tabHeader}`}>
        <Tabs.Root value="content" onValueChange={() => {}}>
          <Tabs.List>
            <Tabs.Trigger value="content">Content</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <div className={styles.headerActions}>
          {!activeFolderData?.read_only && (
            <MenuButton.Root>
              <MenuButton.Trigger
                element={
                  <button type="button" className={styles.action} title="New">
                    <TbPlus size={13} />
                  </button>
                }
              />
              <MenuButton.Menu>
                <Menu.Item
                  leftSlot={<TbFolderOpen size={13} />}
                  onClick={() => setFolderDialog({ open: true, parent: contentFolder })}
                >
                  New folder
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbUpload size={13} />}
                  onClick={() => treeRef.current?.openUpload(contentFolder)}
                >
                  Upload file
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbPlus size={13} />}
                  onClick={() => setDiagramFolder(contentFolder)}
                >
                  New diagram
                </Menu.Item>
                <Menu.Item
                  leftSlot={<TbFileText size={13} />}
                  onClick={() => setMarkdownFolder(contentFolder)}
                >
                  New wiki page
                </Menu.Item>
                <Menu.Separator />
                <Menu.Item
                  leftSlot={<TbGitBranch size={13} />}
                  onClick={() => setMountDialogOpen(true)}
                >
                  Mount Git repository
                </Menu.Item>
              </MenuButton.Menu>
            </MenuButton.Root>
          )}
        </div>
      </div>
      <div className={styles.scroll}>
        {mountActionError && (
          <div style={{ padding: '8px 12px', color: 'var(--error, #b42318)', fontSize: 12 }}>
            {mountActionError}
          </div>
        )}
        <ContentTree
          ref={treeRef}
          rootFiles={data?.rootFiles ?? []}
          folders={data?.folders ?? []}
          activeFileId={activeFileId}
          activeFolder={contentFolder}
          operations={operations}
          beforeTree={
            <TreeRow
              label="Home"
              icon={<TbHome size={13} />}
              active={!contentFolder && !activeFileId}
              onClick={() => navigateHome()}
            />
          }
          onFolderClick={navigateHome}
          onDownload={download}
          onFileClick={file =>
            navigate(
              file.type === 'markdown'
                ? {
                    to: '/$workspaceSlug/content/wiki/$nodeId',
                    params: { workspaceSlug, nodeId: file.id },
                    search: file.read_only ? { mode: 'preview' } : undefined
                  }
                : {
                    to: '/$workspaceSlug/content/diagrams/$diagramId',
                    params: { workspaceSlug, diagramId: file.id }
                  }
            )
          }
          onCreateFolder={parent => setFolderDialog({ open: true, parent })}
          onCreateDiagram={setDiagramFolder}
          onCreateMarkdown={setMarkdownFolder}
          onMountContextMenu={(event, mountId) => {
            event.preventDefault();
            event.stopPropagation();
            setMountMenu({ x: event.clientX, y: event.clientY, mountId });
          }}
        />
      </div>
      <ContentFolderDialog
        open={folderDialog.open}
        parentFolder={folderDialog.parent ?? undefined}
        onClose={() => setFolderDialog({ open: false, parent: null })}
        onCreated={() => setFolderDialog({ open: false, parent: null })}
        onSubmit={path => operations.createFolder.mutateAsync(path)}
        isPending={operations.createFolder.isPending}
        placeholder="e.g. Architecture"
      />
      <AddDiagramDialog
        open={diagramFolder !== undefined}
        onClose={() => setDiagramFolder(undefined)}
        onCreated={file => {
          setDiagramFolder(undefined);
          navigate({
            to: '/$workspaceSlug/content/diagrams/$diagramId',
            params: { workspaceSlug, diagramId: file.id }
          });
        }}
        workspaceId={workspaceSlug}
        context="workspace"
        folder={diagramFolder ?? null}
      />
      <AddMarkdownDialog
        open={markdownFolder !== undefined}
        onClose={() => setMarkdownFolder(undefined)}
        onCreated={file => {
          setMarkdownFolder(undefined);
          navigate({
            to: '/$workspaceSlug/content/wiki/$nodeId',
            params: { workspaceSlug, nodeId: file.id },
            search: { mode: 'edit' }
          });
        }}
        onCreate={name =>
          operations.createMarkdown.mutateAsync({ name, folder: markdownFolder ?? null })
        }
        isPending={operations.createMarkdown.isPending}
      />
      <MountExternalContentDialog
        workspaceId={workspaceSlug}
        open={mountDialogOpen || !!editMount}
        mount={editMount}
        onClose={() => {
          setMountDialogOpen(false);
          setEditMount(null);
        }}
      />
      {mountMenu && (
        <ContextMenu.Imperative x={mountMenu.x} y={mountMenu.y} onClose={() => setMountMenu(null)}>
          <Menu.Item
            leftSlot={<TbPencil size={13} />}
            disabled={!selectedMount}
            onClick={() => {
              if (selectedMount) setEditMount(selectedMount);
              setMountMenu(null);
            }}
          >
            Edit
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbRefresh size={13} />}
            disabled={!selectedMount || externalOperations.sync.isPending}
            onClick={() => {
              if (selectedMount) {
                void externalOperations.sync.mutateAsync(selectedMount.id).catch(caught => {
                  setMountActionError(
                    caught instanceof ApiError ? caught.message : 'Unable to refresh content mount'
                  );
                });
              }
              setMountMenu(null);
            }}
          >
            Refresh
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbInfoCircle size={13} />}
            disabled={!selectedMount}
            onClick={() => {
              if (selectedMount) setStatusMount(selectedMount);
              setMountMenu(null);
            }}
          >
            Status
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item
            type="danger"
            leftSlot={<TbTrash size={13} />}
            disabled={!selectedMount}
            onClick={() => {
              if (selectedMount) setDeleteMount(selectedMount);
              setMountMenu(null);
            }}
          >
            Delete
          </Menu.Item>
        </ContextMenu.Imperative>
      )}
      <ExternalContentStatusDialog
        mount={statusMount}
        open={!!statusMount}
        onClose={() => setStatusMount(null)}
      />
      <DeleteConfirmationDialog
        open={!!deleteMount}
        title="Remove content mount?"
        message={
          deleteMount ? `Remove ${deleteMount.destination_path} and its synchronized content?` : ''
        }
        detail="The source repository will not be changed."
        confirmLabel={externalOperations.remove.isPending ? 'Removing…' : 'Remove mount'}
        onConfirm={() => void removeMount()}
        onCancel={() => setDeleteMount(null)}
      />
    </>
  );
};
