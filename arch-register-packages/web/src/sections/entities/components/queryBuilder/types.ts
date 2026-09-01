import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  WorkspaceLifecycleState,
  WorkspaceOwnerOption
} from '@arch-register/api-types/workspaceContract';
import type { WorkspaceEnum } from '@arch-register/api-types/enumContract';
import type { Assessment } from '@arch-register/api-types/assessmentContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { PathSchemaScope } from '../pathBuilder/pathBuilderState';

/** Everything a leaf row needs to edit a relation-traversal path and its terminal field, threaded
 *  unchanged from `QueryBuilder` through the group tree (#2354, plan phase 5). */
export type LeafContext = {
  schemas: EntitySchema[];
  relationSchemas: RelationSchema[];
  enums: WorkspaceEnum[];
  lifecycleStates: WorkspaceLifecycleState[];
  owners: WorkspaceOwnerOption[];
  joinedAssessment?: Assessment | null;
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess;
  /** Entity schema(s) the root of the query is scoped to (`EntityQuery.schemaId`), or `'any'`. */
  rootSchemaScope: PathSchemaScope;
  /** True once the query already uses the full `MAX_PATH_HOPS` budget - leaves disable "Add hop". */
  atHopLimit: boolean;
};
