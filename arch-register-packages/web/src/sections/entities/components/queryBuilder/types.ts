import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { PathPosition, PathSchemaScope } from '../pathBuilder/pathBuilderState';

/** Everything a leaf row needs to edit a relation-traversal path and its terminal field, threaded
 *  unchanged from `QueryBuilder` through the group tree (#2354, plan phase 5; relation-rooted
 *  traversal added #3120). */
export type LeafContext = {
  /** Whether the query is rooted at an entity or a relation row. Both root kinds now support
   *  hop-chain traversal (entity-to-entity for `rootKind: 'entity'`; `endpoint`/`relationForward`/
   *  `relationBackward` for `rootKind: 'relation'`, #3120) - a flat `FilterRow` is just the
   *  `path: []` case of the same editor. */
  rootKind: 'entity' | 'relation';
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  joinedAssessment?: Assessment | null;
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  /** Entity schema(s) the root of the query is scoped to (`EntityQuery.schemaId`), or `'any'`. Used
   *  by the entity-only hop editor (`rootKind: 'entity'`) and by `leafPath.ts`'s scope helpers. */
  rootSchemaScope: PathSchemaScope;
  /** Where the root of the query starts, position-aware (#3120): `{ kind: 'entity', schemaScope:
   *  rootSchemaScope }` for an entity root, `{ kind: 'relation', relationScope }` for a relation
   *  root (narrowed to a single relation schema when the browser's own Type filter narrows it,
   *  `'any'` otherwise). Used by the relation-rooted hop editor. */
  rootPosition: PathPosition;
  /** True once the query already uses the full `MAX_PATH_HOPS` budget - leaves disable "Add hop". */
  atHopLimit: boolean;
  /** Whether a top-bar "Search text…" box owns the root free-text clause. When true the root
   *  group hides its "Add text search" action (the box is the way to add it there); nested groups
   *  still offer it for the `text:"x" OR …` case. */
  showFreeText: boolean;
  /** True when this context is a hop's same-instance `[...]` scoped filter - free text is invalid
   *  there (grammar §4.4), so "Add text search" is hidden. */
  inScopedFilter: boolean;
};
