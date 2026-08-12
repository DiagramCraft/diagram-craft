import { useMemo, useCallback, useState } from 'react';
import { Link, useNavigate, useParams, useSearch } from '@tanstack/react-router';
import type {
  PublicCatalogTopology as PublicCatalogTopologyData,
  PublicCatalogTopologyEdge,
  PublicCatalogTopologyNode
} from '@arch-register/api-types/publicCatalogContract';
import { DependencyGraph } from '../components/DependencyGraph';
import type { DependencyGraphEdge, DependencyGraphNode } from '../components/DependencyGraph';
import { usePublicCatalogEntities, usePublicCatalogTopology } from '../hooks/usePublicCatalog';
import styles from './publicCatalog.module.css';

type TopologyDirection = 'both' | 'incoming' | 'outgoing';

type TopologySearch = {
  depth?: number;
  direction?: TopologyDirection;
  q?: string;
  schema?: string;
  relation?: string;
};

const routeParams = () =>
  useParams({ strict: false }) as {
    workspaceSlug?: string;
    entityPublicId?: string;
  };

const topologySearch = () => useSearch({ strict: false }) as TopologySearch;

const topologyRoute = (workspaceSlug: string, entityPublicId: string, search: TopologySearch) => ({
  to: '/public/$workspaceSlug/topology/$entityPublicId' as const,
  params: { workspaceSlug, entityPublicId },
  search: {
    depth: search.depth === 2 ? undefined : search.depth,
    direction: search.direction === 'both' ? undefined : search.direction,
    q: search.q === '' ? undefined : search.q,
    schema: search.schema === '' ? undefined : search.schema,
    relation: search.relation === '' ? undefined : search.relation
  }
});

const formatCount = (value: number, singular: string, plural = `${singular}s`) =>
  `${value} ${value === 1 ? singular : plural}`;

export const PublicCatalogTopologyPicker = () => {
  const { workspaceSlug = '' } = routeParams();
  const search = useSearch({ strict: false }) as { q?: string };
  const [query, setQuery] = useState(search.q ?? '');
  const { data, isLoading, isError } = usePublicCatalogEntities(workspaceSlug, {
    q: query || undefined,
    limit: 200
  });

  if (isLoading) return <div className={styles.state}>Loading published entities…</div>;
  if (isError || !data)
    return <div className={styles.state}>Unable to load published entities.</div>;

  return (
    <section>
      <Link className={styles.back} to="/public/$workspaceSlug" params={{ workspaceSlug }}>
        ← Catalog home
      </Link>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>PUBLIC CATALOG</p>
          <h1>Topology</h1>
        </div>
        <span>{formatCount(data.total, 'published entity', 'published entities')}</span>
      </div>
      <p className={styles.lede}>
        Choose a published entity to explore its publication-safe relationships.
      </p>
      <input
        className={styles.search}
        value={query}
        onChange={event => setQuery(event.target.value)}
        placeholder="Search published entities"
        aria-label="Search published entities for topology"
      />
      {data.total > data.items.length && (
        <p className={styles.muted}>
          Showing the first {data.items.length} matches. Refine the search to find another entity.
        </p>
      )}
      <div className={styles.entityList}>
        {data.items.map(entity => (
          <Link
            className={styles.entityCard}
            key={entity.publicId}
            {...topologyRoute(workspaceSlug, entity.publicId, {})}
          >
            <span className={styles.cardKicker}>{entity.schema.name}</span>
            <strong>{entity.name}</strong>
            <span>{entity.publicId}</span>
          </Link>
        ))}
      </div>
      {data.items.length === 0 && (
        <p className={styles.muted}>No published entities match this search.</p>
      )}
    </section>
  );
};

export const PublicCatalogTopology = () => {
  const { workspaceSlug = '', entityPublicId = '' } = routeParams();
  const search = topologySearch();
  const navigate = useNavigate();
  const depth = search.depth ?? 2;
  const direction = search.direction ?? 'both';
  const { data, isLoading, isError } = usePublicCatalogTopology(workspaceSlug, entityPublicId, {
    depth,
    direction
  });

  const updateSearch = useCallback(
    (changes: Partial<TopologySearch>) => {
      void navigate(topologyRoute(workspaceSlug, entityPublicId, { ...search, ...changes }));
    },
    [entityPublicId, navigate, search, workspaceSlug]
  );

  if (isLoading) return <div className={styles.state}>Loading topology…</div>;
  if (isError || !data)
    return <div className={styles.state}>This published topology is not available.</div>;

  return (
    <TopologyContent
      data={data}
      workspaceSlug={workspaceSlug}
      search={search}
      onSearchChange={updateSearch}
    />
  );
};

const TopologyContent = ({
  data,
  workspaceSlug,
  search,
  onSearchChange
}: {
  data: PublicCatalogTopologyData;
  workspaceSlug: string;
  search: TopologySearch;
  onSearchChange: (changes: Partial<TopologySearch>) => void;
}) => {
  const navigate = useNavigate();
  const root = data.nodes.find(node => node.isRoot) ?? data.nodes[0];
  const schemaOptions = useMemo(
    () => [...new Set(data.nodes.map(node => node.schema.name))].sort(),
    [data.nodes]
  );
  const relationOptions = useMemo(
    () => [...new Set(data.edges.map(edge => edge.label))].sort(),
    [data.edges]
  );

  const visible = useMemo(() => {
    const text = search.q?.trim().toLowerCase() ?? '';
    const matchingNodes = new Set(
      data.nodes
        .filter(node => {
          if (node.publicId === data.rootPublicId) return true;
          if (search.schema && node.schema.name !== search.schema) return false;
          if (!text) return true;
          return [node.name, node.publicId, node.slug, node.schema.name]
            .join(' ')
            .toLowerCase()
            .includes(text);
        })
        .map(node => node.publicId)
    );
    const edges = data.edges.filter(
      edge =>
        (!search.relation || edge.label === search.relation) &&
        matchingNodes.has(edge.from) &&
        matchingNodes.has(edge.to)
    );
    const nodeIds = new Set<string>([data.rootPublicId]);
    for (const edge of edges) {
      nodeIds.add(edge.from);
      nodeIds.add(edge.to);
    }
    return {
      nodes: data.nodes.filter(node => nodeIds.has(node.publicId)),
      edges
    };
  }, [data, search.q, search.relation, search.schema]);

  const graphNodes = useMemo<DependencyGraphNode<PublicCatalogTopologyNode>[]>(
    () => visible.nodes.map(node => ({ id: node.publicId, data: node })),
    [visible.nodes]
  );
  const graphEdges = useMemo<DependencyGraphEdge[]>(
    () => visible.edges.map(edge => ({ ...edge })),
    [visible.edges]
  );

  const renderNode = useCallback(
    (node: DependencyGraphNode<PublicCatalogTopologyNode>) => (
      <>
        <span className={styles.topologyNodeSchema}>{node.data.schema.name}</span>
        <span className={styles.topologyNodeName}>{node.data.name}</span>
      </>
    ),
    []
  );

  const navigateToNode = useCallback(
    (publicId: string) => {
      void navigate(topologyRoute(workspaceSlug, publicId, search));
    },
    [navigate, search, workspaceSlug]
  );

  return (
    <section>
      <Link className={styles.back} to="/public/$workspaceSlug/topology" params={{ workspaceSlug }}>
        ← Choose another entity
      </Link>
      <div className={styles.pageHeading}>
        <div>
          <p className={styles.eyebrow}>{root?.schema.name ?? 'PUBLIC CATALOG'}</p>
          <h1>{root?.name ?? data.rootPublicId}</h1>
          <p className={styles.muted}>{data.rootPublicId}</p>
        </div>
        <Link
          className={styles.apiLink}
          to="/public/$workspaceSlug/entities/$entityPublicId"
          params={{ workspaceSlug, entityPublicId: data.rootPublicId }}
        >
          View entity
        </Link>
      </div>
      <fieldset className={styles.topologyToolbar}>
        <legend>Topology controls</legend>
        <label className={styles.topologyControl}>
          <span>Depth</span>
          <select
            value={String(search.depth ?? 2)}
            onChange={event => onSearchChange({ depth: Number(event.target.value) })}
          >
            {[1, 2, 3].map(value => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.topologyControl}>
          <span>Direction</span>
          <select
            value={search.direction ?? 'both'}
            onChange={event =>
              onSearchChange({ direction: event.target.value as TopologyDirection })
            }
          >
            <option value="both">Both</option>
            <option value="incoming">Incoming</option>
            <option value="outgoing">Outgoing</option>
          </select>
        </label>
        <label className={styles.topologyControlWide}>
          <span>Search</span>
          <input
            value={search.q ?? ''}
            onChange={event => onSearchChange({ q: event.target.value || undefined })}
            placeholder="Filter entities in this graph"
          />
        </label>
        <label className={styles.topologyControl}>
          <span>Schema</span>
          <select
            value={search.schema ?? ''}
            onChange={event => onSearchChange({ schema: event.target.value || undefined })}
          >
            <option value="">All schemas</option>
            {schemaOptions.map(schema => (
              <option key={schema} value={schema}>
                {schema}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.topologyControlWide}>
          <span>Relation</span>
          <select
            value={search.relation ?? ''}
            onChange={event => onSearchChange({ relation: event.target.value || undefined })}
          >
            <option value="">All relationships</option>
            {relationOptions.map(relation => (
              <option key={relation} value={relation}>
                {relation}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      {data.truncated && (
        <p className={styles.topologyWarning} role="status">
          This map is limited to {data.limits.nodes} entities and {data.limits.edges} relationships.
          Narrow the depth or filters to explore a smaller view.
        </p>
      )}
      <p className={styles.muted}>
        Showing {formatCount(visible.nodes.length, 'entity')} and{' '}
        {formatCount(visible.edges.length, 'relationship')} within the selected view.
      </p>
      <div className={styles.topologyCanvas} role="img" aria-label="Topology graph">
        <DependencyGraph<PublicCatalogTopologyNode>
          nodes={graphNodes}
          edges={graphEdges}
          layout="hierarchy"
          nodeWidth={220}
          nodeHeight={58}
          renderNode={renderNode}
          onNodeClick={navigateToNode}
          highlightedIds={new Set([data.rootPublicId])}
        />
      </div>
      <TopologyTable
        nodes={visible.nodes}
        edges={visible.edges}
        workspaceSlug={workspaceSlug}
        search={search}
      />
    </section>
  );
};

const TopologyTable = ({
  nodes,
  edges,
  workspaceSlug,
  search
}: {
  nodes: PublicCatalogTopologyNode[];
  edges: PublicCatalogTopologyEdge[];
  workspaceSlug: string;
  search: TopologySearch;
}) => (
  <div className={styles.topologyTableBlock}>
    <h2>Accessible relationship list</h2>
    <table className={styles.topologyTable}>
      <caption>Published entities in this topology</caption>
      <thead>
        <tr>
          <th scope="col">Entity</th>
          <th scope="col">Schema</th>
          <th scope="col">Public ID</th>
        </tr>
      </thead>
      <tbody>
        {nodes.map(node => (
          <tr key={node.publicId}>
            <th scope="row">
              <Link {...topologyRoute(workspaceSlug, node.publicId, search)}>{node.name}</Link>
              {node.isRoot && <span className={styles.topologyRootLabel}>Root</span>}
            </th>
            <td>{node.schema.name}</td>
            <td>{node.publicId}</td>
          </tr>
        ))}
      </tbody>
    </table>
    {edges.length > 0 && (
      <table className={styles.topologyTable}>
        <caption>Published relationships in this topology</caption>
        <thead>
          <tr>
            <th scope="col">From</th>
            <th scope="col">Relationship</th>
            <th scope="col">To</th>
          </tr>
        </thead>
        <tbody>
          {edges.map(edge => (
            <tr key={edge.id}>
              <td>
                <Link {...topologyRoute(workspaceSlug, edge.from, search)}>{edge.from}</Link>
              </td>
              <td>
                {edge.label} <span className={styles.topologyKind}>({edge.kind})</span>
              </td>
              <td>
                <Link {...topologyRoute(workspaceSlug, edge.to, search)}>{edge.to}</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);
