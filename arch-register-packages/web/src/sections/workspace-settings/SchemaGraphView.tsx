import { useState, useMemo, useCallback, useEffect } from 'react';
import { getRouteApi } from '@tanstack/react-router';
import { useWorkspaceContext } from '../../layouts/WorkspaceContext';
import { DependencyGraph } from '../../components/DependencyGraph';
import type {
  LayoutAlgorithm,
  DependencyGraphEdge,
  LayoutOptions
} from '../../components/DependencyGraph';
import { TypeBadge } from '../../components/TypeBadge';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { resolveSchemaColor } from '../../lib/schemaPresentation';
import { TbFileExport, TbVectorTriangle } from 'react-icons/tb';
import styles from './SchemaGraphView.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { SaveDiagramFromGraphDialog } from '../entities/components/SaveDiagramFromGraphDialog';
import { createDiagramFromGraph } from '../../lib/diagramFromGraph';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import type { ModelOverviewSearchParams } from '../../routes/searchParams';

const DEFAULT_LAYOUT: LayoutAlgorithm = 'hierarchy';

const DEFAULT_LAYOUT_OPTIONS: Required<LayoutOptions> = {
  horizontalSpacing: 200,
  verticalSpacing: 108,
  iterations: 300,
  springStrength: 0.5,
  repulsionStrength: 1.0,
  idealEdgeLength: 160,
  crossingMinimizationIterations: 10
};

const SHARED_LAYOUT_KEYS = ['horizontalSpacing', 'verticalSpacing'] as const;
const HIERARCHY_LAYOUT_KEYS = [...SHARED_LAYOUT_KEYS, 'crossingMinimizationIterations'] as const;
const FORCE_LAYOUT_KEYS = [
  'iterations',
  'springStrength',
  'repulsionStrength',
  'idealEdgeLength'
] as const;
const TREE_LAYOUT_KEYS = SHARED_LAYOUT_KEYS;

type LayoutOptionKey = keyof LayoutOptions;
type LayoutOptionCache = Record<LayoutAlgorithm, Required<LayoutOptions>>;

const getApplicableKeys = (layout: LayoutAlgorithm): readonly LayoutOptionKey[] => {
  switch (layout) {
    case 'hierarchy':
    case 'layered':
      return HIERARCHY_LAYOUT_KEYS;
    case 'force':
      return FORCE_LAYOUT_KEYS;
    case 'tree':
      return TREE_LAYOUT_KEYS;
  }
};

const buildDefaultLayoutOptionCache = (): LayoutOptionCache => ({
  hierarchy: { ...DEFAULT_LAYOUT_OPTIONS },
  layered: { ...DEFAULT_LAYOUT_OPTIONS },
  force: { ...DEFAULT_LAYOUT_OPTIONS },
  tree: { ...DEFAULT_LAYOUT_OPTIONS }
});

const getRouteLayoutOptions = (
  layout: LayoutAlgorithm,
  search: ModelOverviewSearchParams
): Required<LayoutOptions> => ({
  ...DEFAULT_LAYOUT_OPTIONS,
  ...(getApplicableKeys(layout).includes('horizontalSpacing')
    ? { horizontalSpacing: search.horizontalSpacing ?? DEFAULT_LAYOUT_OPTIONS.horizontalSpacing }
    : {}),
  ...(getApplicableKeys(layout).includes('verticalSpacing')
    ? { verticalSpacing: search.verticalSpacing ?? DEFAULT_LAYOUT_OPTIONS.verticalSpacing }
    : {}),
  ...(getApplicableKeys(layout).includes('crossingMinimizationIterations')
    ? {
        crossingMinimizationIterations:
          search.crossingMinimizationIterations ??
          DEFAULT_LAYOUT_OPTIONS.crossingMinimizationIterations
      }
    : {}),
  ...(getApplicableKeys(layout).includes('iterations')
    ? { iterations: search.iterations ?? DEFAULT_LAYOUT_OPTIONS.iterations }
    : {}),
  ...(getApplicableKeys(layout).includes('springStrength')
    ? { springStrength: search.springStrength ?? DEFAULT_LAYOUT_OPTIONS.springStrength }
    : {}),
  ...(getApplicableKeys(layout).includes('repulsionStrength')
    ? { repulsionStrength: search.repulsionStrength ?? DEFAULT_LAYOUT_OPTIONS.repulsionStrength }
    : {}),
  ...(getApplicableKeys(layout).includes('idealEdgeLength')
    ? { idealEdgeLength: search.idealEdgeLength ?? DEFAULT_LAYOUT_OPTIONS.idealEdgeLength }
    : {})
});

const areLayoutOptionsEqual = (
  a: Required<LayoutOptions>,
  b: Required<LayoutOptions>,
  keys: readonly LayoutOptionKey[]
) => keys.every(key => a[key] === b[key]);

const serializeSearch = (
  layout: LayoutAlgorithm,
  options: Required<LayoutOptions>
): ModelOverviewSearchParams => {
  const search: ModelOverviewSearchParams = {
    layout: layout === DEFAULT_LAYOUT ? undefined : layout
  };

  for (const key of getApplicableKeys(layout)) {
    const value = options[key];
    if (value !== DEFAULT_LAYOUT_OPTIONS[key]) {
      search[key] = value;
    }
  }

  return search;
};

const routeApi = getRouteApi('/authenticated/$workspaceSlug/settings/model-overview');

export const SchemaGraphView = () => {
  const { schemas, workspaceSlug, workspace } = useWorkspaceContext();
  const navigate = routeApi.useNavigate();
  const search = routeApi.useSearch();
  const layout = search.layout ?? DEFAULT_LAYOUT;
  const [saveDiagramOpen, setSaveDiagramOpen] = useState(false);
  const [pendingDiagramContent, setPendingDiagramContent] =
    useState<SerializedDiagramDocument | null>(null);
  const [layoutOptionCache, setLayoutOptionCache] = useState<LayoutOptionCache>(
    buildDefaultLayoutOptionCache
  );
  const layoutOptions = getRouteLayoutOptions(layout, search);

  useEffect(() => {
    setLayoutOptionCache(previous => {
      const nextOptions = getRouteLayoutOptions(layout, search);
      if (areLayoutOptionsEqual(previous[layout], nextOptions, getApplicableKeys(layout))) {
        return previous;
      }

      return {
        ...previous,
        [layout]: {
          ...previous[layout],
          ...nextOptions
        }
      };
    });
  }, [layout, search]);

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
          existing.fields.push(field.name);
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
        to: '/$workspaceSlug/settings/schemas',
        params: { workspaceSlug },
        search: { tab: 'types', schema: schemaId }
      });
    },
    [navigate, workspaceSlug]
  );

  const updateSearch = useCallback(
    (nextLayout: LayoutAlgorithm, nextOptions: Required<LayoutOptions>, replace: boolean) => {
      navigate({
        to: '/$workspaceSlug/settings/model-overview',
        params: { workspaceSlug },
        search: serializeSearch(nextLayout, nextOptions),
        replace
      });
    },
    [navigate, workspaceSlug]
  );

  const setLayoutOption = useCallback(
    (key: LayoutOptionKey, value: number | undefined) => {
      const nextOptions = {
        ...layoutOptions,
        [key]: value ?? DEFAULT_LAYOUT_OPTIONS[key]
      };

      setLayoutOptionCache(previous => ({
        ...previous,
        [layout]: {
          ...previous[layout],
          ...nextOptions
        }
      }));
      updateSearch(layout, nextOptions, true);
    },
    [layout, layoutOptions, updateSearch]
  );

  const setActiveLayout = useCallback(
    (nextLayout: LayoutAlgorithm) => {
      const nextOptions = layoutOptionCache[nextLayout];
      updateSearch(nextLayout, nextOptions, false);
    },
    [layoutOptionCache, updateSearch]
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
          data-testid="model-overview-layout"
          value={layout}
          onChange={v => {
            if (v) setActiveLayout(v as LayoutAlgorithm);
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
              data-testid="model-overview-horizontal-spacing"
              value={layoutOptions.horizontalSpacing ?? 200}
              onChange={v => setLayoutOption('horizontalSpacing', v)}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>V-Space</span>
            <NumberInput
              data-testid="model-overview-vertical-spacing"
              value={layoutOptions.verticalSpacing ?? 108}
              onChange={v => setLayoutOption('verticalSpacing', v)}
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
              data-testid="model-overview-crossings"
              value={layoutOptions.crossingMinimizationIterations ?? 10}
              onChange={v => setLayoutOption('crossingMinimizationIterations', v)}
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
              data-testid="model-overview-iterations"
              value={layoutOptions.iterations ?? 300}
              onChange={v => setLayoutOption('iterations', v)}
              min={50}
              max={1000}
              step={50}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>Spring</span>
            <NumberInput
              data-testid="model-overview-spring-strength"
              value={layoutOptions.springStrength ?? 0.5}
              onChange={v => setLayoutOption('springStrength', v)}
              min={0.1}
              max={2.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Repulsion</span>
            <NumberInput
              data-testid="model-overview-repulsion-strength"
              value={layoutOptions.repulsionStrength ?? 1.0}
              onChange={v => setLayoutOption('repulsionStrength', v)}
              min={0.1}
              max={3.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Length</span>
            <NumberInput
              data-testid="model-overview-ideal-edge-length"
              value={layoutOptions.idealEdgeLength ?? 160}
              onChange={v => setLayoutOption('idealEdgeLength', v)}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
          </>
        )}

        <Button
          size={'sm'}
          onClick={() => {
            const graphNodes = schemas.map(s => ({ id: s.id, label: s.name }));
            const graphEdges = edges.map(e => ({
              id: e.id,
              from: e.from,
              to: e.to,
              label: e.label,
              kind: e.kind
            }));
            const diagramName = workspace?.name ? `${workspace.name} model` : 'Model overview';
            const content = createDiagramFromGraph(diagramName, graphNodes, graphEdges, {
              layout,
              ...layoutOptions,
              nodeWidth: 170,
              nodeHeight: 48
            });
            setPendingDiagramContent(content);
            setSaveDiagramOpen(true);
          }}
        >
          <TbFileExport size={14} />
          Create diagram
        </Button>
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

      {saveDiagramOpen && pendingDiagramContent && (
        <SaveDiagramFromGraphDialog
          open={saveDiagramOpen}
          onClose={() => setSaveDiagramOpen(false)}
          onCreated={(_file: ProjectFile) => setSaveDiagramOpen(false)}
          workspaceId={workspaceSlug}
          diagramContent={pendingDiagramContent}
          defaultName={workspace?.name ? `${workspace.name} model` : 'Model overview'}
          initialDestination={{ type: 'workspace' }}
        />
      )}
    </div>
  );
};
