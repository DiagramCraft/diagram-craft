import { useMemo, useState, type ComponentProps } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import { Banner } from '../../../components/Banner';
import { LabeledSelect } from '../../../components/LabeledSelect';
import { LoadingState } from '../../../components/LoadingState';
import { useTeams } from '../../../hooks/useWorkspaceConfig';
import {
  DEFAULT_BLAST_RADIUS_DEPTH,
  useBlastRadius,
  type BlastRadiusPath
} from '../../../hooks/useBlastRadius';
import {
  buildBlastRadiusTree,
  type BlastRadiusEntity,
  type BlastRadiusTreeNode
} from '../../../lib/blastRadiusFilters';
import { BlastRadiusItem, BlastRadiusToolbar } from './BlastRadiusPanel';
import { EntityTabPage } from './EntityTabPage';
import styles from './EntityBlastRadiusTab.module.css';

type Props = {
  workspaceId: string;
  entityId: string;
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
};

// Backward hops reach the entities that point at this one (incoming), forward hops reach the
// entities this one points at (outgoing) - the same split as the Relations tab.
const INCOMING_PATHS: readonly BlastRadiusPath[] = [
  { id: 'blast-radius-incoming', steps: [{ kind: 'relationSubtree', direction: 'backward' }] }
];
const OUTGOING_PATHS: readonly BlastRadiusPath[] = [
  { id: 'blast-radius-outgoing', steps: [{ kind: 'relationSubtree', direction: 'forward' }] }
];

type ViewMode = 'depth' | 'tree';

type ItemProps = {
  schemas: EntitySchema[];
  lifecycleStates: WorkspaceLifecycleState[];
  hopLookup: ComponentProps<typeof BlastRadiusItem>['hopLookup'];
};

// Each level is indented one step; the tree is at most three levels deep (see the depth filter).
const TreeNode = ({ node, ...itemProps }: { node: BlastRadiusTreeNode } & ItemProps) => (
  <div className={styles.treeNode}>
    <BlastRadiusItem variant="card" entity={node.entity} {...itemProps} />
    {node.children.length > 0 && (
      <div className={styles.treeChildren}>
        {node.children.map(child => (
          <TreeNode key={child.entity.entityId} node={child} {...itemProps} />
        ))}
      </div>
    )}
  </div>
);

const Column = ({
  title,
  workspaceId,
  entityId,
  paths,
  depth,
  ownerId,
  viewMode,
  schemas,
  lifecycleStates
}: {
  title: string;
  paths: readonly BlastRadiusPath[];
  depth: number;
  ownerId: string | null;
  viewMode: ViewMode;
} & Props) => {
  const { status, entities, totalCount, hopLookup } = useBlastRadius(
    workspaceId,
    { kind: 'entity', entityId },
    { maxDepth: depth, ownerId, schemaIds: null, viaSchemaIds: null },
    true,
    paths
  );

  const depthGroups = useMemo(() => {
    const byDepth = new Map<number, BlastRadiusEntity[]>();
    for (const entity of entities) {
      // Depth 0 is the entity itself.
      if (entity.depth < 1) continue;
      byDepth.set(entity.depth, [...(byDepth.get(entity.depth) ?? []), entity]);
    }
    return [...byDepth.entries()].sort(([a], [b]) => a - b);
  }, [entities]);

  const tree = useMemo(() => buildBlastRadiusTree(entities), [entities]);
  const itemProps = { schemas, lifecycleStates, hopLookup };

  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>{title}</div>
      {status === 'loading' ? (
        <LoadingState text="Computing…" size="sm" />
      ) : status === 'error' ? (
        <Banner variant="error">Could not compute the blast radius.</Banner>
      ) : depthGroups.length === 0 ? (
        <div className={styles.empty}>
          {totalCount === 0 ? 'None within the selected depth' : 'None match the current filters'}
        </div>
      ) : viewMode === 'tree' ? (
        <div className={styles.cardList}>
          {tree.map(node => (
            <TreeNode key={node.entity.entityId} node={node} {...itemProps} />
          ))}
        </div>
      ) : (
        <div className={styles.depthGroups}>
          {depthGroups.map(([groupDepth, groupEntities]) => (
            <div key={groupDepth} className={styles.depthGroup}>
              <div className={styles.depthLabel}>Depth {groupDepth}</div>
              <div className={styles.cardList}>
                {groupEntities.map(entity => (
                  <BlastRadiusItem
                    key={entity.entityId}
                    variant="card"
                    entity={entity}
                    {...itemProps}
                    showVia
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

/**
 * Blast radius of an entity as two columns - what is incoming (depends on it) and what is outgoing
 * (what it depends on) - up to three hops out, optionally narrowed to one owning team.
 */
export const EntityBlastRadiusTab = (props: Props) => {
  const [depth, setDepth] = useState(DEFAULT_BLAST_RADIUS_DEPTH);
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('depth');
  const { data: teams } = useTeams(props.workspaceId);
  const ownerOptions = useMemo(
    () => [
      { value: 'all', label: 'All owners' },
      ...(teams ?? []).map(team => ({ value: team.id, label: team.name }))
    ],
    [teams]
  );
  const ownerId = ownerFilter === 'all' ? null : ownerFilter;

  return (
    <EntityTabPage>
      <BlastRadiusToolbar
        depth={depth}
        setDepth={setDepth}
        ownerFilter={ownerFilter}
        setOwnerFilter={setOwnerFilter}
        ownerOptions={ownerOptions}
      >
        <LabeledSelect
          label="View"
          value={viewMode}
          onChange={value => setViewMode(value as ViewMode)}
          options={[
            { value: 'depth', label: 'By depth' },
            { value: 'tree', label: 'Tree' }
          ]}
        />
      </BlastRadiusToolbar>
      <div className={styles.columns}>
        <Column
          title="Incoming"
          paths={INCOMING_PATHS}
          depth={depth}
          ownerId={ownerId}
          viewMode={viewMode}
          {...props}
        />
        <Column
          title="Outgoing"
          paths={OUTGOING_PATHS}
          depth={depth}
          ownerId={ownerId}
          viewMode={viewMode}
          {...props}
        />
      </div>
    </EntityTabPage>
  );
};
