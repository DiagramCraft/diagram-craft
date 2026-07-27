import type { BackstageEntity, BackstageReferenceValue } from './backstage.js';
import type { SchemaMapping } from './config.js';

export interface ArchRegisterEntity {
  _schemaId: string;
  _name: string;
  _namespace?: string;
  _description?: string;
  _tags?: string[];
  _links?: Array<{
    url: string;
    title: string;
    type?: string;
  }>;
  _owner?: string;
  _lifecycle?: string;
  [key: string]: unknown;
}

export interface MappingResult {
  entity: ArchRegisterEntity | null;
  relationships: RelationshipMapping[];
  errors: string[];
  warnings: string[];
}

export interface RelationshipMapping {
  field: string;
  defaultKind: string;
  references: BackstageReferenceValue[];
}

/**
 * Maps a Backstage entity to Arch Register entity format
 * Returns null if the entity cannot be mapped (e.g., unsupported kind, missing schema ID)
 */
export const mapBackstageToArchRegister = (
  entity: BackstageEntity,
  schemaMapping: SchemaMapping
): MappingResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const relationships: RelationshipMapping[] = [];

  // Determine schema ID based on entity kind
  const schemaId = getSchemaIdForKind(entity.kind, schemaMapping);
  if (!schemaId) {
    errors.push(
      `No schema mapping found for kind '${entity.kind}'. Configure SCHEMA_${entity.kind.toUpperCase()} or ensure schema auto-discovery is working.`
    );
    return { entity: null, relationships, errors, warnings };
  }

  // Build base entity with common fields
  const archEntity: ArchRegisterEntity = {
    _schemaId: schemaId,
    _name: entity.metadata.title || entity.metadata.name,
    _namespace: entity.metadata.namespace || 'default',
    _description: entity.metadata.description
  };

  // Map tags
  if (entity.metadata.tags && entity.metadata.tags.length > 0) {
    archEntity._tags = entity.metadata.tags;
  }

  // Map links
  if (entity.metadata.links && entity.metadata.links.length > 0) {
    archEntity._links = entity.metadata.links.map(link => ({
      url: link.url,
      title: link.title,
      type: link.type
    }));
  }

  // Map owner (if present in spec)
  if (entity.spec.owner && typeof entity.spec.owner === 'string') {
    archEntity._owner = entity.spec.owner;
  }

  // Map lifecycle (if present in spec)
  if (entity.spec.lifecycle && typeof entity.spec.lifecycle === 'string') {
    archEntity._lifecycle = entity.spec.lifecycle;
  }

  // Map kind-specific fields
  switch (entity.kind) {
    case 'Component':
      mapComponentFields(entity, archEntity, relationships, warnings);
      break;
    case 'API':
      mapApiFields(entity, archEntity, relationships, warnings);
      break;
    case 'Resource':
      mapResourceFields(entity, archEntity, relationships, warnings);
      break;
    case 'System':
      mapSystemFields(entity, archEntity, warnings, relationships);
      break;
    case 'Domain':
      // Domain has no additional fields in the template
      break;
    default:
      warnings.push(`Unknown entity kind '${entity.kind}' - using base mapping only`);
  }

  return { entity: archEntity, relationships, errors, warnings };
};

const retainRelationship = (
  entity: BackstageEntity,
  field: string,
  defaultKind: string,
  relationships: RelationshipMapping[]
): void => {
  const value = entity.spec[field];
  relationships.push({
    field,
    defaultKind,
    references:
      value === undefined
        ? []
        : Array.isArray(value)
          ? (value as BackstageReferenceValue[])
          : [value as BackstageReferenceValue]
  });
};

/**
 * Maps Component-specific fields
 */
const mapComponentFields = (
  entity: BackstageEntity,
  archEntity: ArchRegisterEntity,
  relationships: RelationshipMapping[],
  warnings: string[]
): void => {
  // Map spec.type to 'kind' field (enum: service, library, website, documentation)
  if (entity.spec.type && typeof entity.spec.type === 'string') {
    archEntity.kind = entity.spec.type;
  }

  // Map technology from annotations or spec
  const techAnnotation = entity.metadata.annotations?.['backstage.io/techdocs-ref'];
  if (techAnnotation && typeof techAnnotation === 'string') {
    archEntity.technology = techAnnotation;
  }

  retainRelationship(entity, 'system', 'system', relationships);
  retainRelationship(entity, 'providesApis', 'api', relationships);
  retainRelationship(entity, 'consumesApis', 'api', relationships);

  // Warn about unmapped fields
  if (entity.spec.dependsOn) {
    warnings.push('Field spec.dependsOn is not mapped in the current Backstage template schema');
  }
  if (entity.spec.subcomponentOf) {
    warnings.push(
      'Field spec.subcomponentOf is not mapped in the current Backstage template schema'
    );
  }
};

/**
 * Maps API-specific fields
 */
const mapApiFields = (
  entity: BackstageEntity,
  archEntity: ArchRegisterEntity,
  relationships: RelationshipMapping[],
  warnings: string[]
): void => {
  // Map spec.type to 'api_type' field (enum: openapi, grpc, graphql, asyncapi)
  if (entity.spec.type && typeof entity.spec.type === 'string') {
    archEntity.api_type = entity.spec.type;
  }

  retainRelationship(entity, 'system', 'system', relationships);

  // Note: spec.definition is not stored in the template by default
  // It could be added as a link or external reference
  if (entity.spec.definition) {
    warnings.push(
      'Field spec.definition is present but not stored in the current Backstage template schema. Consider adding it as a link.'
    );
  }
};

/**
 * Maps Resource-specific fields
 */
const mapResourceFields = (
  entity: BackstageEntity,
  archEntity: ArchRegisterEntity,
  relationships: RelationshipMapping[],
  warnings: string[]
): void => {
  // Map spec.type to 'kind' field (enum: database, cache, queue, blob-storage)
  if (entity.spec.type && typeof entity.spec.type === 'string') {
    archEntity.kind = entity.spec.type;
  }

  retainRelationship(entity, 'system', 'system', relationships);

  // Warn about unmapped fields
  if (entity.spec.dependsOn) {
    warnings.push('Field spec.dependsOn is not mapped in the current Backstage template schema');
  }
  if (entity.spec.dependencyOf) {
    warnings.push('Field spec.dependencyOf is not mapped in the current Backstage template schema');
  }
};

/**
 * Maps System-specific fields
 */
const mapSystemFields = (
  entity: BackstageEntity,
  _archEntity: ArchRegisterEntity,
  _warnings: string[],
  relationships: RelationshipMapping[]
): void => {
  retainRelationship(entity, 'domain', 'domain', relationships);
};

/**
 * Gets the schema ID for a given Backstage entity kind
 */
const getSchemaIdForKind = (kind: string, schemaMapping: SchemaMapping): string | undefined => {
  const kindLower = kind.toLowerCase();

  switch (kindLower) {
    case 'component':
      return schemaMapping.component;
    case 'api':
      return schemaMapping.api;
    case 'resource':
      return schemaMapping.resource;
    case 'system':
      return schemaMapping.system;
    case 'domain':
      return schemaMapping.domain;
    default:
      return undefined;
  }
};
