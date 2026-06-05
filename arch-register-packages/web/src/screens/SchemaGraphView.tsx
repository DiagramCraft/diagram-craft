import { useState, useMemo, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { DependencyGraph } from '../components/DependencyGraph';
import type { LayoutAlgorithm, DependencyGraphEdge } from '../components/DependencyGraph';
import { TypeBadge } from '../components/TypeBadge';
import { Select } from '@diagram-craft/app-components/Select';
import { resolveSchemaColor } from '../api';
import type { EntitySchema } from '../api';
import { TbVectorTriangle } from 'react-icons/tb';
import styles from './SchemaGraphView.module.css';

export const SchemaGraphView = () => {
  const { schemas, workspaceSlug } = useWorkspaceContext();
  const navigate = useNavigate();
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');

  const nodes = useMemo(
    () => schemas.map(s => ({ id: s.id, data: s })),
    [schemas]
  );

  const edges = useMemo((): DependencyGraphEdge[] => {
    const seen = new Set<string>();
    const result: DependencyGraphEdge[] = [];
    for (const schema of schemas) {
      for (const field of schema.fields) {
        if (field.type !== 'reference' && field.type !== 'containment') continue;
        if (!field.schemaId || field.schemaId === schema.id) continue;

        // Deduplicate: prefer containment over reference for same from+to pair
        const pairKey = `${schema.id}::${field.schemaId}`;
        const existingIdx = result.findIndex(
          e => e.from === schema.id && e.to === field.schemaId
        );
        if (existingIdx >= 0) {
          // Upgrade to containment if this field is containment
          if (field.type === 'containment' && result[existingIdx]!.kind !== 'containment') {
            result[existingIdx] = {
              ...result[existingIdx]!,
              id: `${schema.id}-${field.id}`,
              kind: 'containment',
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
          kind: field.type,
        });
      }
    }
    return result;
  }, [schemas]);

  const handleNodeClick = useCallback((schemaId: string) => {
    navigate({
      to: '/$workspaceSlug/model',
      params: { workspaceSlug },
      search: { tab: 'types', schema: schemaId },
    });
  }, [navigate, workspaceSlug]);

  const schemaIndexMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, i])),
    [schemas]
  );

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
          onChange={v => { if (v) setLayout(v as LayoutAlgorithm); }}
        >
          <Select.Item value="hierarchy">Hierarchy</Select.Item>
          <Select.Item value="layered">Layered</Select.Item>
          <Select.Item value="force">Force-directed</Select.Item>
          <Select.Item value="tree">Tree</Select.Item>
        </Select.Root>
      </div>
      <div className={styles.canvas}>
        <DependencyGraph<EntitySchema>
          nodes={nodes}
          edges={edges}
          layout={layout}
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
