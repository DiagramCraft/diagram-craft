import { useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Tabs } from '@diagram-craft/app-components/Tabs';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { TbFileText, TbFolderOpen, TbHome, TbPlus, TbUpload } from 'react-icons/tb';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { ContentTree, type ContentTreeHandle } from '../../components/ContentTree';
import { TreeRow } from '../../components/TreeRow';
import {
  contentDownloadUrl, useContentScopeOperations, useContentTree, type ContentScope
} from '../../hooks/useContentScope';
import styles from '../../shell/SidePanel.module.css';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';

export const WorkspaceContentSidebar = ({ workspaceSlug }: { workspaceSlug: string }) => {
  const scope: ContentScope = { kind: 'workspace', workspaceId: workspaceSlug };
  const { data } = useContentTree(scope);
  const operations = useContentScopeOperations(scope);
  const treeRef = useRef<ContentTreeHandle>(null);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parent: string | null }>({ open: false, parent: null });
  const [diagramFolder, setDiagramFolder] = useState<string | null | undefined>(undefined);
  const [markdownFolder, setMarkdownFolder] = useState<string | null | undefined>(undefined);
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { diagramId?: string; nodeId?: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string; contentQuery?: string; contentView?: 'grid' | 'list' };
  const activeFileId = params.nodeId ?? params.diagramId ?? null;

  const navigateHome = (contentFolder?: string) => navigate({
    to: '/$workspaceSlug/content', params: { workspaceSlug },
    search: { contentFolder, contentQuery: search.contentQuery, contentView: search.contentView }
  });
  const download = (file: ProjectFile) => {
    const anchor = document.createElement('a');
    anchor.href = contentDownloadUrl(scope, file.path); anchor.download = file.original_filename ?? file.name;
    document.body.appendChild(anchor); anchor.click(); document.body.removeChild(anchor);
  };

  return <>
    <div className={`${styles.header} ${styles.tabHeader}`}>
      <Tabs.Root value="content" onValueChange={() => {}}><Tabs.List><Tabs.Trigger value="content">Content</Tabs.Trigger></Tabs.List></Tabs.Root>
      <div className={styles.headerActions}><MenuButton.Root>
        <MenuButton.Trigger element={<button type="button" className={styles.action} title="New"><TbPlus size={13} /></button>} />
        <MenuButton.Menu>
          <Menu.Item leftSlot={<TbFolderOpen size={13} />} onClick={() => setFolderDialog({ open: true, parent: search.contentFolder ?? null })}>New folder</Menu.Item>
          <Menu.Item leftSlot={<TbUpload size={13} />} onClick={() => treeRef.current?.openUpload(search.contentFolder ?? null)}>Upload file</Menu.Item>
          <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => setDiagramFolder(search.contentFolder ?? null)}>New diagram</Menu.Item>
          <Menu.Item leftSlot={<TbFileText size={13} />} onClick={() => setMarkdownFolder(search.contentFolder ?? null)}>New wiki page</Menu.Item>
        </MenuButton.Menu>
      </MenuButton.Root></div>
    </div>
    <div className={styles.scroll}>
      <ContentTree ref={treeRef} rootFiles={data?.rootFiles ?? []} folders={data?.folders ?? []}
        activeFileId={activeFileId} activeFolder={search.contentFolder ?? null} operations={operations}
        beforeTree={<TreeRow label="Home" icon={<TbHome size={13} />} active={!search.contentFolder && !activeFileId} onClick={() => navigateHome()} />}
        onFolderClick={navigateHome} onDownload={download}
        onFileClick={file => navigate(file.type === 'markdown'
          ? { to: '/$workspaceSlug/content/wiki/$nodeId', params: { workspaceSlug, nodeId: file.id } }
          : { to: '/$workspaceSlug/content/diagrams/$diagramId', params: { workspaceSlug, diagramId: file.id } })}
        onCreateFolder={parent => setFolderDialog({ open: true, parent })}
        onCreateDiagram={setDiagramFolder} onCreateMarkdown={setMarkdownFolder} />
    </div>
    <ContentFolderDialog open={folderDialog.open} parentFolder={folderDialog.parent ?? undefined}
      onClose={() => setFolderDialog({ open: false, parent: null })}
      onCreated={() => setFolderDialog({ open: false, parent: null })}
      onSubmit={path => operations.createFolder.mutateAsync(path)} isPending={operations.createFolder.isPending} placeholder="e.g. Architecture" />
    <AddDiagramDialog open={diagramFolder !== undefined} onClose={() => setDiagramFolder(undefined)}
      onCreated={file => { setDiagramFolder(undefined); navigate({ to: '/$workspaceSlug/content/diagrams/$diagramId', params: { workspaceSlug, diagramId: file.id } }); }}
      workspaceId={workspaceSlug} context="workspace" folder={diagramFolder ?? null} />
    <AddMarkdownDialog open={markdownFolder !== undefined} onClose={() => setMarkdownFolder(undefined)}
      onCreated={file => { setMarkdownFolder(undefined); navigate({ to: '/$workspaceSlug/content/wiki/$nodeId', params: { workspaceSlug, nodeId: file.id }, search: { mode: 'edit' } }); }}
      onCreate={name => operations.createMarkdown.mutateAsync({ name, folder: markdownFolder ?? null })}
      isPending={operations.createMarkdown.isPending} />
  </>;
};
