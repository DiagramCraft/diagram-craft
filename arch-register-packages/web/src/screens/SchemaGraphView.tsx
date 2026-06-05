import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { DependencyGraph } from '../components/DependencyGraph';
import type {
  LayoutAlgorithm,
  DependencyGraphEdge,
  LayoutOptions
} from '../components/DependencyGraph';
import { TypeBadge } from '../components/TypeBadge';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { resolveSchemaColor } from '../api';
import type { EntitySchema } from '../api';
import { TbVectorTriangle } from 'react-icons/tb';
import styles from './SchemaGraphView.module.css';

export const SchemaGraphView = () => {
  const { schemas, workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>({
    horizontalSpacing: 200,
    verticalSpacing: 108,
    iterations: 300,
    springStrength: 0.5,
    repulsionStrength: 1.0,
    idealEdgeLength: 160,
    crossingMinimizationIterations: 10
  });

  const nodes = useMemo(() => schemas.map(s => ({ id: s.id, data: s })), [schemas]);

  const edges = useMemo((): DependencyGraphEdge[] => {
    const seen = new Set<string>();
    const result: DependencyGraphEdge[] = [];
    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') continue;
        if (!field.schemaId || field.schemaId === schema.id) continue;

        // Deduplicate: prefer containment over reference for same from+to pair
        const pairKey = `${schema.id}::${field.schemaId}`;
        const existingIdx = result.findIndex(e => e.from === schema.id && e.to === field.schemaId);
        if (existingIdx >= 0) {
          // Upgrade to containment if this field is containment
          if (field.type === 'containment' && result[existingIdx]!.kind !== 'containment') {
            result[existingIdx] = {
              ...result[existingIdx]!,
              id: `${schema.id}-${field.id}`,
              kind: 'containment'
            };
          }
          continue;
        }
        seen.add(pairKey);
        result.push({
          id: `${schema.id}-${field.id}`,
          from: schema.id,
          to: field.schemaId,
          label: field.name,
          kind: field.type
        });
      }
    }
    return result;
  }, [schemas]);

  const handleNodeClick = useCallback(
    (schemaId: string) => {
      navigate({
        to: '/$workspaceSlug/model',
        params: { workspaceSlug },
        search: { tab: 'types', schema: schemaId }
      });
    },
    [navigate, workspaceSlug]
  );

  const schemaIndexMap = useMemo(() => new Map(schemas.map((s, i) => [s.id, i])), [schemas]);

  if (schemas.length === 0) {
    return (
      <div className={styles.empty}>
        <TbVectorTriangle size={22} />
        <div className={styles.emptyTitle}>No entity types defined yet.</div>
        <div>Add entity types to see their dependencies here.</div>
      </div>
    );
  }

  return (
    <div className={styles.screen}>
      <div className={styles.toolbar}>
        <span className={styles.toolbarLabel}>Layout</span>
        <Select.Root
          value={layout}
          onChange={v => {
            if (v) setLayout(v as LayoutAlgorithm);
          }}
        >
          <Select.Item value="hierarchy">Hierarchy</Select.Item>
          <Select.Item value="layered">Layered</Select.Item>
          <Select.Item value="force">Force-directed</Select.Item>
          <Select.Item value="tree">Tree</Select.Item>
        </Select.Root>

        <div className={styles.toolbarSeparator} />

        {(layout === 'hierarchy' || layout === 'layered' || layout === 'tree') && (
          <>
            <span className={styles.toolbarLabel}>H-Space</span>
            <NumberInput
              value={layoutOptions.horizontalSpacing ?? 200}
              onChange={v => setLayoutOptions(prev => ({ ...prev, horizontalSpacing: v }))}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
            <span className={styles.toolbarLabel}>V-Space</span>
            <NumberInput
              value={layoutOptions.verticalSpacing ?? 108}
              onChange={v => setLayoutOptions(prev => ({ ...prev, verticalSpacing: v }))}
              min={50}
              max={300}
              step={10}
              style={{ width: '60px' }}
            />
          </>
        )}

        {(layout === 'hierarchy' || layout === 'layered') && (
          <>
            <span className={styles.toolbarLabel}>Crossings</span>
            <NumberInput
              value={layoutOptions.crossingMinimizationIterations ?? 10}
              onChange={v =>
                setLayoutOptions(prev => ({ ...prev, crossingMinimizationIterations: v }))
              }
              min={1}
              max={50}
              step={1}
              style={{ width: '50px' }}
            />
          </>
        )}

        {layout === 'force' && (
          <>
            <span className={styles.toolbarLabel}>Iterations</span>
            <NumberInput
              value={layoutOptions.iterations ?? 300}
              onChange={v => setLayoutOptions(prev => ({ ...prev, iterations: v }))}
              min={50}
              max={1000}
              step={50}
              style={{ width: '60px' }}
            />
            <span className={styles.toolbarLabel}>Spring</span>
            <NumberInput
              value={layoutOptions.springStrength ?? 0.5}
              onChange={v => setLayoutOptions(prev => ({ ...prev, springStrength: v }))}
              min={0.1}
              max={2.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.toolbarLabel}>Repulsion</span>
            <NumberInput
              value={layoutOptions.repulsionStrength ?? 1.0}
              onChange={v => setLayoutOptions(prev => ({ ...prev, repulsionStrength: v }))}
              min={0.1}
              max={3.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.toolbarLabel}>Length</span>
            <NumberInput
              value={layoutOptions.idealEdgeLength ?? 160}
              onChange={v => setLayoutOptions(prev => ({ ...prev, idealEdgeLength: v }))}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
          </>
        )}
      </div>
      <div className={styles.canvas}>
        <DependencyGraph<EntitySchema>
          nodes={nodes}
          edges={edges}
          layout={layout}
          layoutOptions={layoutOptions}
          nodeWidth={170}
          nodeHeight={48}
          renderNode={node => {
            const idx = schemaIndexMap.get(node.id) ?? 0;
            const color = resolveSchemaColor(node.data, idx);
            return (
              <>
                <TypeBadge color={color} name={node.data.name} icon={node.data.icon} size={20} />
                <span className={styles.nodeLabel}>{node.data.name}</span>
              </>
            );
          }}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};
