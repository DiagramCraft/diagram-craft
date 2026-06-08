import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type {
  LayoutAlgorithm,
  DependencyGraphEdge,
  LayoutOptions
} from '../../../components/DependencyGraph';
import { TypeBadge } from '../../../components/TypeBadge';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { resolveSchemaColor } from '../../../lib/api';
import type { EntitySchema } from '../../../lib/api';
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
    const edgeMap = new Map<string, { fields: string[]; kind: string }>();

    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') continue;
        if (!field.schemaId) continue;

        const pairKey = `${schema.id}::${field.schemaId}`;
        const existing = edgeMap.get(pairKey);

        if (existing) {
          // Add field name to existing edge
          existing.fields.push(field.name);
          // Upgrade to containment if this field is containment
          if (field.type === 'containment' && existing.kind !== 'containment') {
            existing.kind = 'containment';
          }
        } else {
          edgeMap.set(pairKey, {
            fields: [field.name],
            kind: field.type
          });
        }
      }
    }

    return Array.from(edgeMap.entries()).map(([pairKey, data]) => {
      const [from, to] = pairKey.split('::');
      return {
        id: pairKey,
        from: from!,
        to: to!,
        label: data.fields.join(', '),
        kind: data.kind
      };
    });
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
      <div className={styles.eEmpty}>
        <TbVectorTriangle size={22} />
        <div className={styles.eEmptyTitle}>No entity types defined yet.</div>
        <div>Add entity types to see their dependencies here.</div>
      </div>
    );
  }

  return (
    <div className={styles.icSchemaGraphView}>
      <div className={styles.eToolbar}>
        <span className={styles.eToolbarLabel}>Layout</span>
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

        <div className={styles.eToolbarSeparator} />

        {(layout === 'hierarchy' || layout === 'layered' || layout === 'tree') && (
          <>
            <span className={styles.eToolbarLabel}>H-Space</span>
            <NumberInput
              value={layoutOptions.horizontalSpacing ?? 200}
              onChange={v => setLayoutOptions(prev => ({ ...prev, horizontalSpacing: v }))}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>V-Space</span>
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
            <span className={styles.eToolbarLabel}>Crossings</span>
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
            <span className={styles.eToolbarLabel}>Iterations</span>
            <NumberInput
              value={layoutOptions.iterations ?? 300}
              onChange={v => setLayoutOptions(prev => ({ ...prev, iterations: v }))}
              min={50}
              max={1000}
              step={50}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>Spring</span>
            <NumberInput
              value={layoutOptions.springStrength ?? 0.5}
              onChange={v => setLayoutOptions(prev => ({ ...prev, springStrength: v }))}
              min={0.1}
              max={2.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Repulsion</span>
            <NumberInput
              value={layoutOptions.repulsionStrength ?? 1.0}
              onChange={v => setLayoutOptions(prev => ({ ...prev, repulsionStrength: v }))}
              min={0.1}
              max={3.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Length</span>
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
      <div className={styles.eCanvas}>
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
                <span className={styles.eNodeLabel}>{node.data.name}</span>
              </>
            );
          }}
          onNodeClick={handleNodeClick}
        />
      </div>
    </div>
  );
};
