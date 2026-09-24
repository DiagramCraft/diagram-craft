import type {
  EntityTraversalGraphDiffRequest,
  EntityTraversalGraphDiffResponse
} from '@arch-register/api-types/entityTraversalContract';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { requireProjectAccess } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type { EntityDbResult } from './db/catalogDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import {
  getActiveRevisionOrThrow,
  getCaseMemberSubject,
  getCaseOrThrow
} from './changeCaseContext';
import { executeEntityTraversal, type EntityTraversalHop } from './entityTraversal';
import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';
import { reconstructRelationsAsOf } from './relationSnapshotReconstruction';
import { resolveTraversalRootEntityIds } from './entityTraversalOperations';

type GraphNode = EntityTraversalGraphDiffResponse['nodes']['added'][number]['node'];
type GraphPath = EntityTraversalGraphDiffResponse['nodes']['added'][number]['path'];
type GraphEdge = EntityTraversalGraphDiffResponse['edges']['added'][number];

type GraphState = {
  nodes: Map<string, GraphNode>;
  paths: Map<string, GraphPath>;
  edges: Map<string, GraphEdge>;
};

const nodeKey = (node: Pick<GraphNode, 'context' | 'id'>): string => `${node.context}:${node.id}`;

const edgeKey = (edge: GraphEdge): string =>
  `${edge.pathId}:${edge.stepIndex}:${nodeKey(edge.from)}:${nodeKey(edge.to)}`;

const pathKey = (path: GraphPath): string =>
  `${path.pathId ?? ''}\u0000${path.hops.map(nodeKey).join('\u0000')}`;

const comparePaths = (left: GraphPath, right: GraphPath): number =>
  left.hops.length - right.hops.length ||
  (left.pathId ?? '').localeCompare(right.pathId ?? '') ||
  pathKey(left).localeCompare(pathKey(right));

const toGraphNode = (hop: EntityTraversalHop): GraphNode => ({
  context: hop.context,
  id: hop.id,
  schemaId: hop.schemaId
});

const toEntityRow = (entity: EntityDbResult): Record<string, unknown> => ({
  id: entity.id,
  workspace: entity.workspace,
  public_id: entity.public_id,
  slug: entity.slug,
  namespace: entity.namespace,
  name: entity.name,
  description: entity.description,
  owner: entity.owner,
  lifecycle: entity.lifecycle,
  target_lifecycle: entity.target_lifecycle,
  target_lifecycle_date: entity.target_lifecycle_date,
  tags: entity.tags,
  links: entity.links,
  schema_id: entity.schema_id,
  data: entity.data,
  project_id: entity.project_id,
  created_at: entity.created_at,
  updated_at: entity.updated_at,
  version: entity.version ?? 1,
  completeness: entity.completeness,
  generated_metadata: entity.generated_metadata ?? {},
  approval_policy_override: entity.approval_policy_override ?? null
});

const toRelationRow = (relation: RelationDbResult): Record<string, unknown> => ({
  id: relation.id,
  workspace: relation.workspace,
  schema_id: relation.schema_id,
  data: relation.data,
  owner: relation.owner,
  lifecycle: relation.lifecycle,
  version: relation.version,
  approval_policy_override: relation.approval_policy_override,
  created_at: relation.created_at,
  updated_at: relation.updated_at,
  in_record_id: relation.in_entity_id,
  out_record_id: relation.out_entity_id
});

const snapshotRows = (entities: EntityDbResult[], relations: RelationDbResult[]) => ({
  entities: entities.map(toEntityRow),
  relations: relations.map(toRelationRow)
});

const toGraphState = (
  result: Awaited<ReturnType<typeof executeEntityTraversal>>,
  rootNodes: ReadonlyMap<string, GraphNode>
): GraphState => {
  const nodes = new Map<string, GraphNode>();
  const paths = new Map<string, GraphPath>();
  const edges = new Map<string, GraphEdge>();

  const addPath = (node: GraphNode, path: GraphPath) => {
    const key = nodeKey(node);
    nodes.set(key, node);
    const previous = paths.get(key);
    if (previous == null || comparePaths(path, previous) < 0) paths.set(key, path);
  };

  result.roots.forEach(root => {
    const rootNode = rootNodes.get(root.rootId);
    if (!rootNode) return;
    addPath(rootNode, { pathId: null, hops: [rootNode] });

    root.paths.forEach(path => {
      path.occurrences.forEach(occurrence => {
        const provenance = occurrence.provenance.map(toGraphNode);
        const terminal = toGraphNode({
          context: occurrence.terminal.context,
          id: occurrence.terminal.id,
          schemaId: occurrence.terminal.schemaId
        });
        const hops = [...provenance];
        if (hops.length === 0 || nodeKey(hops[0]!) !== nodeKey(rootNode)) hops.unshift(rootNode);
        if (nodeKey(hops[hops.length - 1]!) !== nodeKey(terminal)) hops.push(terminal);

        hops.forEach((node, hopIndex) => {
          addPath(node, { pathId: path.pathId, hops: hops.slice(0, hopIndex + 1) });
          if (hopIndex === 0) return;
          const edge: GraphEdge = {
            pathId: path.pathId,
            stepIndex: hopIndex - 1,
            from: hops[hopIndex - 1]!,
            to: node
          };
          edges.set(edgeKey(edge), edge);
        });
      });
    });
  });

  return { nodes, paths, edges };
};

const sortedValues = <T>(values: Iterable<T>, key: (value: T) => string): T[] =>
  [...values].sort((left, right) => key(left).localeCompare(key(right)));

const diffGraphStates = (
  before: GraphState,
  after: GraphState
): EntityTraversalGraphDiffResponse => {
  const addedNodeChanges = [...after.nodes.entries()]
    .filter(([key]) => !before.nodes.has(key))
    .map(([key, node]) => ({ node, path: after.paths.get(key)! }));
  const removedNodeChanges = [...before.nodes.entries()]
    .filter(([key]) => !after.nodes.has(key))
    .map(([key, node]) => ({ node, path: before.paths.get(key)! }));
  const pathChanged = [...after.nodes.entries()]
    .filter(([key]) => before.nodes.has(key))
    .flatMap(([key, node]) => {
      const beforePath = before.paths.get(key);
      const afterPath = after.paths.get(key);
      if (beforePath == null || afterPath == null || pathKey(beforePath) === pathKey(afterPath))
        return [];
      return [{ node, beforePath, afterPath }];
    });

  const addedEdges = [...after.edges.entries()]
    .filter(([key]) => !before.edges.has(key))
    .map(([, edge]) => edge);
  const removedEdges = [...before.edges.entries()]
    .filter(([key]) => !after.edges.has(key))
    .map(([, edge]) => edge);

  return {
    nodes: {
      added: addedNodeChanges.sort((a, b) => nodeKey(a.node).localeCompare(nodeKey(b.node))),
      removed: removedNodeChanges.sort((a, b) => nodeKey(a.node).localeCompare(nodeKey(b.node))),
      pathChanged: pathChanged.sort((a, b) => nodeKey(a.node).localeCompare(nodeKey(b.node)))
    },
    edges: {
      added: sortedValues(addedEdges, edgeKey),
      removed: sortedValues(removedEdges, edgeKey)
    }
  };
};

const resolveRootNodes = async (
  db: DatabaseAdapter,
  workspace: string,
  traversal: Awaited<ReturnType<typeof executeEntityTraversal>>,
  entities: readonly EntityDbResult[] | null
): Promise<Map<string, GraphNode>> => {
  const visibleRootIds = new Set(traversal.roots.map(root => root.rootId));
  const entityById = new Map((entities ?? []).map(entity => [entity.id, entity]));
  const entries = await Promise.all(
    [...visibleRootIds].map(async rootId => {
      const entity = entityById.get(rootId) ?? (await db.catalog.getEntity(workspace, rootId));
      return entity == null
        ? null
        : ([
            rootId,
            { context: 'entity' as const, id: rootId, schemaId: entity.schema_id }
          ] as const);
    })
  );
  return new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry != null));
};

export const diffSubjectTraversal = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext | null,
  input: EntityTraversalGraphDiffRequest
): Promise<EntityTraversalGraphDiffResponse> => {
  const candidateCaseId =
    input.candidateCaseId ??
    (input.subject.kind === 'changeCase' ? input.subject.caseId : undefined);
  httpAssert.present(candidateCaseId, {
    status: 400,
    message: 'A candidate planned-change case is required for entity or relation subjects'
  });

  const changeCase = await getCaseOrThrow(db, workspace, candidateCaseId);
  httpAssert.true(changeCase.purpose === 'planned_change', {
    status: 400,
    message: 'The candidate case must be a planned change'
  });
  if (authCtx && changeCase.project_id) {
    const project = await db.project.projects.getProject(workspace, changeCase.project_id);
    httpAssert.present(project, {
      status: 404,
      message: `Project '${changeCase.project_id}' not found`
    });
    requireProjectAccess(authCtx, project.owner);
  }
  const revision = await getActiveRevisionOrThrow(db, workspace, changeCase.id);

  const rootEntityIds = await resolveTraversalRootEntityIds(db, workspace, input.subject);
  const paths = input.paths.map(path => ({ id: path.id, steps: path.steps }));
  const now = new Date();
  const members = await db.changeCase.listMembers(workspace, revision.id);
  const candidateMemberSubjects = await Promise.all(
    members.map(member => getCaseMemberSubject(db, workspace, member.entity_id))
  );
  const candidateEntityIds = candidateMemberSubjects.flatMap(subject =>
    subject?.kind === 'entity' ? [subject.entity.id] : []
  );
  const candidateRelationIds = candidateMemberSubjects.flatMap(subject =>
    subject?.kind === 'relation' ? [subject.relation.id] : []
  );
  const [liveTraversal, candidateState] = await Promise.all([
    executeEntityTraversal(db, workspace, authCtx, {
      root: { kind: 'ids', entityIds: rootEntityIds },
      paths,
      maxDepth: input.maxDepth,
      maxNodes: input.maxNodes
    }),
    Promise.all([
      reconstructEntitiesAsOf(
        db,
        workspace,
        now,
        authCtx,
        candidateEntityIds,
        true,
        changeCase.project_id,
        undefined,
        revision.id
      ),
      reconstructRelationsAsOf(
        db,
        workspace,
        now,
        authCtx,
        candidateRelationIds,
        true,
        changeCase.project_id,
        undefined,
        revision.id
      )
    ])
  ]);
  const [candidateEntities, candidateRelations] = candidateState;
  const snapshot = snapshotRows(candidateEntities, candidateRelations);
  const candidateTraversal = await executeEntityTraversal(db, workspace, authCtx, {
    root: { kind: 'ids', entityIds: rootEntityIds },
    paths,
    maxDepth: input.maxDepth,
    maxNodes: input.maxNodes,
    snapshot
  });

  const [liveRootNodes, candidateRootNodes] = await Promise.all([
    resolveRootNodes(db, workspace, liveTraversal, null),
    resolveRootNodes(db, workspace, candidateTraversal, candidateEntities)
  ]);
  return diffGraphStates(
    toGraphState(liveTraversal, liveRootNodes),
    toGraphState(candidateTraversal, candidateRootNodes)
  );
};
