import { useState } from 'react';
import { TbFile, TbFileText, TbFolder, TbHome, TbPlus } from 'react-icons/tb';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import localStyles from './EntityContentSidebar.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/api';
import { TypeBadge } from '../../components/TypeBadge';
import { AddEntityFolderDialog } from './AddEntityFolderDialog';
import {
  asEntityPublicId,
  asProjectPublicId,
  entityDetailRoute,
  entityDiagramRoute,
  entityMarkdownRoute,
  projectMarkdownRoute,
  projectDiagramRoute
} from '../../routes/publicObjectRoutes';

export const EntityContentSidebar = ({
  workspaceSlug,
  entityId
}: {
  workspaceSlug: string;
  entityId: string;
}) => {
  const { data: entity } = useEntity(workspaceSlug, entityId);
  const { data } = useEntityContentNodes(workspaceSlug, entityId);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [addFolderOpen, setAddFolderOpen] = useState(false);
  const ctx = useWorkspaceContext();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { diagramId?: string; nodeId?: string };
  const search = useSearch({ strict: false }) as { contentFolder?: string };
  const contentFolder = search.contentFolder;
  const activeFileId = params.nodeId ?? params.diagramId ?? null;
  const isFileRoute = activeFileId !== null;

  const schemaIdx = ctx.schemas.findIndex(s => s.id === entity?._schema?.id);
  const schema = schemaIdx >= 0 ? ctx.schemas[schemaIdx] : undefined;
  const accentColor = schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)';

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Build folder tree for nested rendering
  type FolderNode = {
    path: string;
    name: string;
    files: Array<{
      id: string;
      name: string;
      path: string;
      project_id: string | null;
      project_public_id?: string | null;
      type: 'diagram' | 'folder' | 'markdown' | 'file';
    }>;
    children: FolderNode[];
  };

  const buildFolderTree = (
    folders: Array<{
      path: string;
      name: string;
      files: Array<{
        id: string;
        name: string;
        path: string;
        project_id: string | null;
        project_public_id?: string | null;
        type: 'diagram' | 'folder' | 'markdown' | 'file';
      }>;
    }>
  ): FolderNode[] => {
    const root: FolderNode[] = [];
    const map = new Map<string, FolderNode>();

    const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));

    for (const folder of sorted) {
      const parts = folder.path.split('/');
      const node: FolderNode = { 
        path: folder.path, 
        name: folder.name, 
        files: folder.files,
        children: [] 
      };
      map.set(folder.path, node);

      if (parts.length === 1) {
        root.push(node);
      } else {
        const parentPath = parts.slice(0, -1).join('/');
        const parent = map.get(parentPath);
        if (parent) {
          parent.children.push(node);
        } else {
          // Parent not found, add to root (shouldn't happen with proper data)
          root.push(node);
        }
      }
    }

    return root;
  };

  const folderTree = data ? buildFolderTree(data.folders) : [];
  const activeFilePath = data
    ? [...data.rootFiles, ...data.folders.flatMap(folder => folder.files)].find(file => file.id === activeFileId)?.path ?? null
    : null;

  const renderFolderNode = (node: FolderNode, depth: number = 0): React.ReactNode => {
    const isExpanded =
      expandedFolders.has(node.path) ||
      activeFilePath?.startsWith(`${node.path}/`);
    return (
      <div key={node.path}>
        <TreeRow
          icon={<TbFolder size={13} />}
          label={node.name}
          expandable
          expanded={isExpanded}
          active={contentFolder === node.path}
          depth={depth}
          onExpand={() => toggleFolder(node.path)}
          onClick={() => {
            navigate(
              entityDetailRoute(workspaceSlug, asEntityPublicId(entityId), {
                contentFolder: node.path
              })
            );
          }}
        />
        {isExpanded && (
          <>
            {node.files.map(file => (
              <TreeRow
                key={file.id}
                depth={depth + 1}
                icon={file.type === 'markdown' ? <TbFileText size={13} /> : <TbFile size={13} />}
                label={file.name}
                active={file.id === activeFileId}
                onClick={() => {
                  const projectId = file.project_public_id ?? file.project_id;
                  if (projectId) {
                    navigate(
                      file.type === 'markdown'
                        ? projectMarkdownRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
                        : projectDiagramRoute(workspaceSlug, asProjectPublicId(projectId), file.id)
                    );
                  } else {
                    navigate(
                      file.type === 'markdown'
                        ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
                        : entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
                    );
                  }
                }}
              />
            ))}
            {node.children.map(child => renderFolderNode(child, depth + 1))}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <div className={`${styles.header} ${localStyles.header}`} style={{ '--fold-accent': accentColor } as React.CSSProperties}>
        <TypeBadge
          color={accentColor}
          name={schema?.name}
          icon={schema?.icon ?? null}
          size={14}
        />
        <span className={localStyles.entityName}>{entity?._name ?? '…'}</span>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.action}
            onClick={() => setAddFolderOpen(true)}
            title="New folder"
          >
            <TbPlus size={13} />
          </button>
        </div>
      </div>
      <div className={styles.scroll}>
        <TreeRow
          label="Home"
          icon={<TbHome size={13} />}
          active={!contentFolder && !isFileRoute}
          onClick={() => {
            navigate(entityDetailRoute(workspaceSlug, asEntityPublicId(entityId)));
          }}
        />
        {data?.rootFiles.map(file => (
          <TreeRow
            key={file.id}
            icon={file.type === 'markdown' ? <TbFileText size={13} /> : <TbFile size={13} />}
            label={file.name}
            active={file.id === activeFileId}
            onClick={
              file.project_public_id ?? file.project_id
                ? () => {
                    const projectId = asProjectPublicId(file.project_public_id ?? file.project_id!);
                    navigate(
                      file.type === 'markdown'
                        ? projectMarkdownRoute(workspaceSlug, projectId, file.id)
                        : projectDiagramRoute(workspaceSlug, projectId, file.id)
                    );
                  }
                : () => {
                    navigate(
                      file.type === 'markdown'
                        ? entityMarkdownRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
                        : entityDiagramRoute(workspaceSlug, asEntityPublicId(entityId), file.id)
                    );
                  }
            }
          />
        ))}
        {folderTree.map(node => renderFolderNode(node, 0))}
      </div>
      <AddEntityFolderDialog
        open={addFolderOpen}
        onClose={() => setAddFolderOpen(false)}
        onCreated={() => setAddFolderOpen(false)}
        workspaceSlug={workspaceSlug}
        entityId={entityId}
        parentFolder={contentFolder}
      />
    </>
  );
};
