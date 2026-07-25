import type { BackstageEntity } from './backstage.js';
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
  errors: string[];
  warnings: string[];
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

  // Determine schema ID based on entity kind
  const schemaId = getSchemaIdForKind(entity.kind, schemaMapping);
  if (!schemaId) {
    errors.push(
      `No schema mapping found for kind '${entity.kind}'. Configure SCHEMA_${entity.kind.toUpperCase()} or ensure schema auto-discovery is working.`
    );
    return { entity: null, errors, warnings };
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
      mapComponentFields(entity, archEntity, warnings);
      break;
    case 'API':
      mapApiFields(entity, archEntity, warnings);
      break;
    case 'Resource':
      mapResourceFields(entity, archEntity, warnings);
      break;
    case 'System':
      mapSystemFields(entity, archEntity, warnings);
      break;
    case 'Domain':
      // Domain has no additional fields in the template
      break;
    default:
      warnings.push(`Unknown entity kind '${entity.kind}' - using base mapping only`);
  }

  return { entity: archEntity, errors, warnings };
};

/**
 * Maps Component-specific fields
 */
const mapComponentFields = (
  entity: BackstageEntity,
  archEntity: ArchRegisterEntity,
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

  // Map system reference (containment relationship)
  if (entity.spec.system && typeof entity.spec.system === 'string') {
    warnings.push(
      'Field spec.system is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }

  // Map providesApis (reference field)
  if (entity.spec.providesApis && Array.isArray(entity.spec.providesApis)) {
    warnings.push(
      'Field spec.providesApis is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }

  // Map consumesApis (reference field)
  if (entity.spec.consumesApis && Array.isArray(entity.spec.consumesApis)) {
    warnings.push(
      'Field spec.consumesApis is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }

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
  warnings: string[]
): void => {
  // Map spec.type to 'api_type' field (enum: openapi, grpc, graphql, asyncapi)
  if (entity.spec.type && typeof entity.spec.type === 'string') {
    archEntity.api_type = entity.spec.type;
  }

  // Map system reference (containment relationship)
  if (entity.spec.system && typeof entity.spec.system === 'string') {
    warnings.push(
      'Field spec.system is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }

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
  warnings: string[]
): void => {
  // Map spec.type to 'kind' field (enum: database, cache, queue, blob-storage)
  if (entity.spec.type && typeof entity.spec.type === 'string') {
    archEntity.kind = entity.spec.type;
  }

  // Map system reference (optional containment relationship)
  if (entity.spec.system && typeof entity.spec.system === 'string') {
    warnings.push(
      'Field spec.system is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }

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
  _warnings: string[]
): void => {
  // Map domain reference (containment relationship)
  if (entity.spec.domain && typeof entity.spec.domain === 'string') {
    _warnings.push(
      'Field spec.domain is not synced because Backstage entity references are not Arch Register entity IDs'
    );
  }
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
