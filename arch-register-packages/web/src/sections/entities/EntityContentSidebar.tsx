import { useState } from 'react';
import { TbFile, TbFolder, TbHome } from 'react-icons/tb';
import { TreeRow } from '../../components/TreeRow';
import styles from '../../shell/SidePanel.module.css';
import localStyles from './EntityContentSidebar.module.css';
import { useEntityContentNodes } from '../../hooks/useProjects';
import { useEntity } from '../../hooks/useEntities';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../lib/api';
import { TypeBadge } from '../../components/TypeBadge';

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
  const ctx = useWorkspaceContext();

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

  const hasContent = data && (data.rootFiles.length > 0 || data.folders.length > 0);

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
      </div>
      <div className={styles.scroll}>
        <TreeRow
          label="Home"
          icon={<TbHome size={13} />}
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
                label={folder.name}
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
