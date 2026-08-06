import { useCallback, useMemo, useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { DependencyGraph } from '../../components/DependencyGraph';
import type {
  DependencyGraphEdge,
  DependencyGraphNode,
  LayoutAlgorithm,
  LayoutOptions
} from '../../components/DependencyGraph';
import { LoadingState } from '../../components/LoadingState';
import { TypeBadge } from '../../components/TypeBadge';
import { Select } from '@diagram-craft/app-components/Select';
import { useEntitiesByIds } from '../../hooks/useEntities';
import { relationIds } from '../../lib/entityEditState';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TbVectorTriangle } from 'react-icons/tb';
import { RelationDetailPopover } from '../entities/components/RelationDetailPopover';
import { GraphLayoutToolbar } from '../entities/components/GraphLayoutToolbar';
import styles from '../entities/components/EntityGraphView.module.css';
import { buildRelationGraphData, type RelationGraphNodeData } from './relationGraphState';
import { getRelationGraphLabelOptions, RELATION_GRAPH_TYPE_LABEL } from './relationBrowserState';

const defaultLayoutOptions: LayoutOptions = {
  horizontalSpacing: 230,
  verticalSpacing: 108,
  iterations: 300,
  springStrength: 0.5,
  repulsionStrength: 1,
  idealEdgeLength: 160,
  crossingMinimizationIterations: 10
};

type Props = {
  workspaceId: string;
  relations: RelationRecord[];
  relationSchemas: RelationSchema[];
  entitySchemas: EntitySchema[];
  isLoading: boolean;
  edgeLabelFieldId: string;
  onEdgeLabelFieldIdChange: (fieldId: string) => void;
  onEntityClick: (id: string) => void;
};

export const RelationGraphView = ({
  workspaceId,
  relations,
  relationSchemas,
  entitySchemas,
  isLoading,
  edgeLabelFieldId,
  onEdgeLabelFieldIdChange,
  onEntityClick
}: Props) => {
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(defaultLayoutOptions);
  const [relationPopover, setRelationPopover] = useState<{
    relationId: string;
    x: number;
    y: number;
  } | null>(null);

  const labelOptions = useMemo(
    () => getRelationGraphLabelOptions(relationSchemas),
    [relationSchemas]
  );
  const selectedEdgeLabelFieldId = labelOptions.some(option => option.value === edgeLabelFieldId)
    ? edgeLabelFieldId
    : RELATION_GRAPH_TYPE_LABEL;
  const selectedFieldIsReference = relationSchemas.some(schema =>
    schema.fields.some(
      field => field.id === selectedEdgeLabelFieldId && field.type === 'entityRelation'
    )
  );
  const referenceIds = useMemo(
    () =>
      selectedFieldIsReference
        ? relations.flatMap(relation => relationIds(relation[selectedEdgeLabelFieldId]))
        : [],
    [relations, selectedEdgeLabelFieldId, selectedFieldIsReference]
  );
  const referenceLookup = useEntitiesByIds(workspaceId, referenceIds);
  const { nodes, edges } = useMemo(
    () =>
      buildRelationGraphData(relations, relationSchemas, selectedEdgeLabelFieldId, referenceLookup),
    [relations, relationSchemas, selectedEdgeLabelFieldId, referenceLookup]
  );
  const schemaMap = useMemo(
    () => new Map(entitySchemas.map((schema, index) => [schema.id, { schema, index }])),
    [entitySchemas]
  );

  const renderNode = useCallback(
    (node: DependencyGraphNode<RelationGraphNodeData>) => {
      const schemaEntry = node.data.entitySchemaId
        ? schemaMap.get(node.data.entitySchemaId)
        : undefined;
      const color = schemaEntry
        ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
        : 'var(--accent-fg)';
      return (
        <>
          <TypeBadge
            color={color}
            name={schemaEntry?.schema.name}
            icon={schemaEntry?.schema.icon}
            size={16}
          />
          <span className={styles.eNodeName}>{node.data.entityName}</span>
        </>
      );
    },
    [schemaMap]
  );

  const handleEdgeClick = useCallback((edge: DependencyGraphEdge, event: React.MouseEvent) => {
    if (edge.relationId) {
      setRelationPopover({ relationId: edge.relationId, x: event.clientX, y: event.clientY });
    }
  }, []);

  return (
    <div className={styles.icEntityGraphView}>
      <div className={styles.eToolbar}>
        <GraphLayoutToolbar
          layout={layout}
          setLayout={setLayout}
          layoutOptions={layoutOptions}
          setLayoutOptions={setLayoutOptions}
          betweenLayoutAndSettings={
            <>
              <span className={styles.eToolbarLabel}>Edge labels</span>
              <Select.Root
                value={selectedEdgeLabelFieldId}
                onChange={value => value && onEdgeLabelFieldIdChange(value)}
              >
                {labelOptions.map(option => (
                  <Select.Item key={option.value} value={option.value}>
                    {option.label}
                  </Select.Item>
                ))}
              </Select.Root>
            </>
          }
        />
        {isLoading && <span className={styles.eLoadingText}>Loading…</span>}
      </div>
      <div className={styles.eCanvas}>
        {isLoading && nodes.length === 0 ? (
          <div className={styles.eEmpty}>
            <LoadingState text="Loading relations…" size="sm" />
          </div>
        ) : nodes.length === 0 ? (
          <div className={styles.eEmpty}>
            <TbVectorTriangle size={22} />
            <div className={styles.eEmptyTitle}>No relations found.</div>
            <div>Try adjusting the current filters.</div>
          </div>
        ) : (
          <DependencyGraph<RelationGraphNodeData>
            nodes={nodes}
            edges={edges}
            layout={layout}
            layoutOptions={layoutOptions}
            nodeWidth={200}
            nodeHeight={52}
            renderNode={renderNode}
            onNodeClick={onEntityClick}
            onEdgeClick={handleEdgeClick}
          />
        )}
        {isLoading && nodes.length > 0 && (
          <div className={styles.eLoadingOverlay}>Loading relations…</div>
        )}
      </div>
      {relationPopover && (
        <RelationDetailPopover
          workspaceId={workspaceId}
          relationId={relationPopover.relationId}
          x={relationPopover.x}
          y={relationPopover.y}
          onClose={() => setRelationPopover(null)}
        />
      )}
    </div>
  );
};
