import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbCopy, TbDownload, TbFolder, TbFolderOpen, TbPencil, TbTrash } from 'react-icons/tb';
import type { useContentScopeOperations } from '../hooks/useContentScope';
import { parentPath, type ContentFolderNode } from '../lib/contentPath';

type Operations = ReturnType<typeof useContentScopeOperations>;

const MoveNodes = ({
  file,
  nodes,
  current,
  operations
}: {
  file: ProjectFile;
  nodes: ContentFolderNode[];
  current: string | null;
  operations: Operations;
}) => (
  <>
    {nodes.map(node =>
      node.children.length ? (
        <Menu.SubMenu key={node.path} label={node.name} leftSlot={<TbFolder size={13} />}>
          <Menu.Item
            disabled={node.path === current}
            leftSlot={<TbFolder size={13} />}
            onClick={() => operations.moveFile.mutate({ file, targetFolder: node.path })}
          >
            {node.name}
          </Menu.Item>
          <MoveNodes file={file} nodes={node.children} current={current} operations={operations} />
        </Menu.SubMenu>
      ) : (
        <Menu.Item
          key={node.path}
          disabled={node.path === current}
          leftSlot={<TbFolder size={13} />}
          onClick={() => operations.moveFile.mutate({ file, targetFolder: node.path })}
        >
          {node.name}
        </Menu.Item>
      )
    )}
  </>
);

/** Context-menu items for a file node (diagram, wiki page or uploaded file). */
export const ContentFileMenuItems = ({
  file,
  tree,
  operations,
  onDownload,
  onRename,
  onDelete
}: {
  file: ProjectFile;
  tree: ContentFolderNode[];
  operations: Operations;
  onDownload: (file: ProjectFile) => void;
  onRename: () => void;
  onDelete: () => void;
}) => {
  const current = parentPath(file.path);
  return (
    <>
      {file.type === 'file' && (
        <>
          <Menu.Item leftSlot={<TbDownload size={13} />} onClick={() => onDownload(file)}>
            Download
          </Menu.Item>
          <Menu.Separator />
        </>
      )}
      {file.type === 'diagram' && (
        <>
          <Menu.Item
            leftSlot={<TbCopy size={13} />}
            onClick={() => operations.cloneFile.mutate(file)}
          >
            Clone
          </Menu.Item>
          <Menu.Separator />
        </>
      )}
      <Menu.SubMenu label="Move to…" leftSlot={<TbFolderOpen size={13} />}>
        <Menu.Item
          disabled={current === null}
          leftSlot={<TbFolderOpen size={13} />}
          onClick={() => operations.moveFile.mutate({ file, targetFolder: null })}
        >
          Root
        </Menu.Item>
        <MoveNodes file={file} nodes={tree} current={current} operations={operations} />
      </Menu.SubMenu>
      <Menu.Item leftSlot={<TbPencil size={13} />} onClick={onRename}>
        Rename
      </Menu.Item>
      <Menu.Separator />
      <Menu.Item type="danger" leftSlot={<TbTrash size={13} />} onClick={onDelete}>
        Delete
      </Menu.Item>
    </>
  );
};
