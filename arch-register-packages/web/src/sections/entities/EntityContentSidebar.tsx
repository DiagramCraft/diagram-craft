import { useRef, useState } from 'react';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { TbFileText, TbFolderOpen, TbHome, TbPlus, TbUpload } from 'react-icons/tb';
import { ContentFolderDialog } from '../../components/ContentFolderDialog';
import { ContentTree, type ContentTreeHandle } from '../../components/ContentTree';
import { TreeRow } from '../../components/TreeRow';
import { TypeBadge } from '../../components/TypeBadge';
import { useEntity } from '../../hooks/useEntities';
import {
  contentDownloadUrl,
  useContentScopeOperations,
  useContentTree,
  type ContentScope
} from '../../hooks/useContentScope';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityContentFolderRoute,
  entityDetailRoute,
  entityDiagramRoute,
  entityMarkdownRoute,
  projectDiagramRoute,
  projectMarkdownRoute
} from '../../routes/publicObjectRoutes';
import type { EntityDetailSearchParams } from '../../routes/searchParams';
import styles from '../../shell/SidePanel.module.css';
import { AddMarkdownDialog } from '../markdown/AddMarkdownDialog';
import { AddDiagramDialog } from '../projects/AddDiagramDialog';
import localStyles from './EntityContentSidebar.module.css';
import { downloadUrl } from '../../lib/browserDownload';

export const EntityContentSidebar = ({
  workspaceSlug,
  entityId
}: {
  workspaceSlug: string;
  entityId: string;
}) => {
  const scope: ContentScope = { kind: 'entity', workspaceId: workspaceSlug, entityId };
  const { data } = useContentTree(scope);
  const operations = useContentScopeOperations(scope);
  const { data: entity } = useEntity(workspaceSlug, entityId);
  const context = useWorkspaceContext();
  const schemaIndex = context.schemas.findIndex(schema => schema.id === entity?._schema?.id);
  const schema = schemaIndex >= 0 ? context.schemas[schemaIndex] : undefined;
  const accentColor = schema ? resolveSchemaColor(schema, schemaIndex) : 'var(--accent-fg)';
  const treeRef = useRef<ContentTreeHandle>(null);
  const [folderDialog, setFolderDialog] = useState<{ open: boolean; parent: string | null }>({
    open: false,
    parent: null
  });
  const [diagramFolder, setDiagramFolder] = useState<string | null | undefined>(undefined);
  const [markdownFolder, setMarkdownFolder] = useState<string | null | undefined>(undefined);
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const search = useSearch({ strict: false }) as EntityDetailSearchParams;
  const contentFolder = params._splat ?? null;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;

  const navigateHome = (folder?: string) => {
    const nextSearch = {
      contentQuery: search.contentQuery,
      contentView: search.contentView,
      tab: search.tab
    };
    if (folder) {
      navigate(
        entityContentFolderRoute(workspaceSlug, asEntityPublicId(entityId), folder, {
          contentQuery: search.contentQuery,
          contentView: search.contentView
        })
      );
    } else {
      navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId), nextSearch));
    }
  };
  const download = (file: ProjectFile) => {
    downloadUrl(contentDownloadUrl(scope, file.path), file.original_filename ?? file.name);
  };
  const openFile = (file: ProjectFile) => {
    const projectId = file.project_public_id ?? file.project_id;
    if (projectId)
      navigate(
        file.type === 'markdown'
          ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
          : projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
      );
    else
      navigate(
        file.type === 'markdown'
          ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
          : entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
      );
  };

  return (
    <>
      <div
        className={`${styles.header} ${localStyles.header}`}
        style={{ '--fold-accent': accentColor } as React.CSSProperties}
      >
        <TypeBadge color={accentColor} name={schema?.name} icon={schema?.icon ?? null} size={14} />
        <span className={localStyles.entityName}>{entity?._name ?? '…'}</span>
        <div className={styles.headerActions}>
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
            </MenuButton.Menu>
          </MenuButton.Root>
        </div>
      </div>
      <div className={styles.scroll}>
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
          onFileClick={openFile}
          onDownload={download}
          onCreateFolder={parent => setFolderDialog({ open: true, parent })}
          onCreateDiagram={setDiagramFolder}
          onCreateMarkdown={setMarkdownFolder}
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
          navigate(entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), file.id));
        }}
        workspaceId={workspaceSlug}
        context="entity"
        entityId={entityId}
        folder={diagramFolder ?? null}
      />
      <AddMarkdownDialog
        open={markdownFolder !== undefined}
        onClose={() => setMarkdownFolder(undefined)}
        onCreated={file => {
          setMarkdownFolder(undefined);
          navigate(
            entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), file.id, {
              mode: 'edit'
            })
          );
        }}
        onCreate={name =>
          operations.createMarkdown.mutateAsync({ name, folder: markdownFolder ?? null })
        }
        isPending={operations.createMarkdown.isPending}
      />
    </>
  );
};
