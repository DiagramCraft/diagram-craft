import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { getEntityAndSchema, requireEntityView, toRevision } from './artifactOperations';
import type {
  ApiSpecificationDiagnosticDb,
  ApiSpecificationItemDbResult,
  ApiSpecificationRevisionDbResult
} from './db/apiSpecificationDatabase';

const toApiSpecificationDiagnostic = (diagnostic: ApiSpecificationDiagnosticDb) => ({
  severity: diagnostic.severity,
  category: diagnostic.category,
  code: diagnostic.code,
  message: diagnostic.message,
  source:
    diagnostic.source_pointer == null
      ? null
      : {
          pointer: diagnostic.source_pointer,
          line: diagnostic.source_line,
          column: diagnostic.source_column
        }
});

const toApiSpecificationItem = (item: ApiSpecificationItemDbResult) => ({
  id: item.id,
  itemKey: item.item_key,
  revisionId: item.artifact_revision_id,
  protocol: item.protocol,
  itemKind: item.item_kind,
  path: item.path,
  channel: item.channel,
  action: item.action,
  identifier: item.identifier,
  declaredIdentifier: item.declared_identifier,
  summary: item.summary,
  description: item.description,
  tags: item.tags,
  deprecated: item.deprecated,
  parameters: item.parameters,
  input: item.input_summary,
  output: item.output_summary,
  metadata: item.metadata,
  source: {
    pointer: item.source_pointer,
    line: item.source_line,
    column: item.source_column
  }
});

const toApiSpecificationRevision = (
  revision: Awaited<ReturnType<DatabaseAdapter['artifact']['getRevision']>>,
  projection: ApiSpecificationRevisionDbResult
) => {
  httpAssert.present(revision, { status: 404, message: 'Artifact revision not found' });
  return {
    revision: toRevision(revision),
    protocol: projection.protocol,
    specificationVersion: projection.specification_version,
    title: projection.title,
    description: projection.description,
    status: projection.status,
    itemCount: projection.item_count,
    diagnostics: projection.diagnostics.map(toApiSpecificationDiagnostic)
  };
};

export const listApiSpecification = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  artifactId: string,
  revisionId: string,
  query: {
    q?: string;
    resource?: string;
    action?: string;
    kind?: 'operation' | 'message';
    tag?: string;
    deprecated?: boolean;
    limit: number;
    offset: number;
  },
  authCtx: AuthorizationContext
) => {
  const { entity } = await getEntityAndSchema(db, workspace, entityId);
  requireEntityView(authCtx, entity);
  const artifact = await db.artifact.getArtifact(workspace, artifactId);
  httpAssert.present(artifact, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.entity_id === entity.id, { status: 404, message: 'Artifact not found' });
  httpAssert.true(artifact.artifact_type === 'api-specification', {
    status: 409,
    message: 'Only API specification artifacts have API specification projections'
  });
  const revision = await db.artifact.getRevision(workspace, revisionId);
  httpAssert.present(revision, { status: 404, message: 'Artifact revision not found' });
  httpAssert.true(revision.artifact_id === artifact.id, {
    status: 404,
    message: 'Artifact revision not found'
  });
  const projection = await db.artifactProjections.apiSpecification.getRevision(
    workspace,
    revision.id
  );
  httpAssert.present(projection, {
    status: 409,
    message: 'Artifact revision has not been projected as an API specification'
  });
  const page = await db.artifactProjections.apiSpecification.listItems(
    workspace,
    revision.id,
    query,
    query
  );
  return {
    revision: toApiSpecificationRevision(revision, projection),
    items: page.items.map(toApiSpecificationItem),
    total: page.total,
    limit: query.limit,
    offset: query.offset
  };
};
