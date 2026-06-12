import { useState, useRef, useEffect } from 'react';
import { TbChevronRight } from 'react-icons/tb';
import styles from './EntityFoldedRail.module.css';
import { useEntity } from '../hooks/useEntities';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../lib/api';
import { EntitiesSidebar } from '../sections/entities/EntitiesSidebar';

const useSchemaAccent = (workspaceSlug: string, entityId: string) => {
  const ctx = useWorkspaceContext();
  const { data: entity } = useEntity(workspaceSlug, entityId);
  const schemaIdx = ctx.schemas.findIndex(s => s.id === entity?._schema?.id);
  const schema = schemaIdx >= 0 ? ctx.schemas[schemaIdx] : undefined;
  return {
    entity,
    schema,
    accentColor: schema ? resolveSchemaColor(schema, schemaIdx) : 'var(--accent-fg)'
  };
};

// --- EntityFoldedRail ---
// 44px strip shown in entity-detail when the primary sidebar is collapsed.
// Hover reveals the full EntitiesSidebar as an overlay flyout.
export const EntityFoldedRail = ({
  workspaceSlug,
  entityId,
  onExpand,
}: {
  workspaceSlug: string;
  entityId: string;
  onExpand: () => void;
}) => {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const ctx = useWorkspaceContext();
  const { accentColor } = useSchemaAccent(workspaceSlug, entityId);

  const enter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(true);
  };
  const leave = () => {
    timerRef.current = setTimeout(() => setOpen(false), 160);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div
      className={`${styles.rail} ${open ? styles.isOpen : ''}`}
      style={{ '--fold-accent': accentColor } as React.CSSProperties}
    >
      <div className={styles.strip} onMouseEnter={enter} onMouseLeave={leave} onClick={open ? () => { setOpen(false); onExpand(); } : undefined}>
        <span className={styles.label}>Entities</span>
        <div className={styles.hint}>
          <TbChevronRight size={9} style={{ transform: 'rotate(90deg)' }} />
        </div>
      </div>

      {open && (
        <div className={styles.flyout} onMouseEnter={enter} onMouseLeave={leave}>
          <EntitiesSidebar
            schemas={ctx.schemas}
            lifecycleStates={ctx.lifecycleStates}
            workspaceSlug={workspaceSlug}
            onExpand={() => { setOpen(false); onExpand(); }}
          />
        </div>
      )}
    </div>
  );
};

// --- EntityNavSidebar ---
// Full 280px sidebar with a schema-colored accent bar and a collapse button.
// Rendered when the user pins the sidebar open or the window is wide enough.
export const EntityNavSidebar = ({
  workspaceSlug,
  entityId,
  onCollapse,
}: {
  workspaceSlug: string;
  entityId: string;
  onCollapse: () => void;
}) => {
  const ctx = useWorkspaceContext();
  const { accentColor } = useSchemaAccent(workspaceSlug, entityId);

  return (
    <div
      className={styles.navSidebar}
      style={{ '--fold-accent': accentColor } as React.CSSProperties}
    >
      <EntitiesSidebar
        schemas={ctx.schemas}
        lifecycleStates={ctx.lifecycleStates}
        workspaceSlug={workspaceSlug}
        onCollapse={onCollapse}
      />
    </div>
  );
};
