import { useState } from 'react';
import { TbFile, TbFolder } from 'react-icons/tb';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';

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

  const hasContent = data && (data.rootFiles.length > 0 || data.folders.length > 0);

  return (
    <>
      <div className={styles.header}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--base-fg-dim)', letterSpacing: '0.4px' }}>
          {entity?._name ?? '…'}
        </span>
      </div>
      <div className={styles.scroll}>
        <TreeRow
          label="Home"
          active
        />
        {!hasContent && (
          <div className={styles.emptyState} style={{ color: 'var(--cmp-fg-disabled)', fontSize: 12 }}>
            No diagrams attached
          </div>
        )}
        {data?.rootFiles.map(file => (
          <TreeRow
            key={file.id}
            icon={<TbFile size={13} />}
            label={file.name}
          />
        ))}
        {data?.folders.map(folder => {
          const isExpanded = expandedFolders.has(folder.path);
          return (
            <div key={folder.path}>
              <TreeRow
                icon={<TbFolder size={13} />}
                label={folder.path}
                expandable
                expanded={isExpanded}
                onExpand={() => toggleFolder(folder.path)}
                onClick={() => toggleFolder(folder.path)}
              />
              {isExpanded &&
                folder.files.map(file => (
                  <TreeRow
                    key={file.id}
                    depth={1}
                    icon={<TbFile size={13} />}
                    label={file.name}
                  />
                ))}
            </div>
          );
        })}
      </div>
    </>
  );
};
