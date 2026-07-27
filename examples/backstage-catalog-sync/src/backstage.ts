import YAML from 'yaml';

export interface BackstageEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    title?: string;
    description?: string;
    labels?: Record<string, string>;
    annotations?: Record<string, string>;
    tags?: string[];
    links?: Array<{
      url: string;
      title: string;
      type?: string;
      icon?: string;
    }>;
  };
  spec: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface BackstageEntityReference {
  kind: string;
  namespace: string;
  name: string;
}

export type BackstageReferenceValue =
  | string
  | { kind?: string; namespace?: string; name?: string }
  | null
  | undefined;

/** Parses a Backstage entity reference using the field's default kind. */
export const parseBackstageReference = (
  value: BackstageReferenceValue,
  defaultKind: string
): BackstageEntityReference | null => {
  if (typeof value === 'object' && value !== null) {
    if (typeof value.name !== 'string' || value.name.length === 0) return null;
    return {
      kind: (value.kind ?? defaultKind).toLowerCase(),
      namespace: value.namespace ?? 'default',
      name: value.name
    };
  }

  if (typeof value !== 'string' || value.trim().length === 0) return null;
  const reference = value.trim();
  const kindSeparator = reference.indexOf(':');
  const kind = kindSeparator >= 0 ? reference.slice(0, kindSeparator) : defaultKind;
  const namePart = kindSeparator >= 0 ? reference.slice(kindSeparator + 1) : reference;
  const parts = namePart.split('/');
  if (
    !kind ||
    parts.length < 1 ||
    parts.length > 2 ||
    parts.some(part => part.length === 0) ||
    (parts.length === 2 && parts[0]!.includes('/'))
  ) {
    return null;
  }

  return {
    kind: kind.toLowerCase(),
    namespace: parts.length === 2 ? parts[0]! : 'default',
    name: parts.length === 2 ? parts[1]! : parts[0]!
  };
};

export const canonicalReferenceKey = (reference: BackstageEntityReference): string =>
  `${reference.namespace}/${reference.kind.toLowerCase()}/${reference.name}`;

/**
 * Parses YAML content and extracts Backstage entities
 * Supports both single-document and multi-document YAML
 */
export const parseBackstageYaml = (content: string): BackstageEntity[] => {
  try {
    const documents = YAML.parseAllDocuments(content);
    const entities: BackstageEntity[] = [];

    for (const doc of documents) {
      if (doc.errors.length > 0) {
        throw new Error(`YAML parsing error: ${doc.errors.map(e => e.message).join(', ')}`);
      }

      const data = doc.toJSON();
      if (data && typeof data === 'object') {
        entities.push(data as BackstageEntity);
      }
    }

    return entities;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse YAML: ${error.message}`);
    }
    throw error;
  }
};

/**
 * Validates a Backstage entity against the expected schema
 */
export const validateEntity = (entity: BackstageEntity): ValidationResult => {
  const errors: string[] = [];

  // Validate apiVersion
  if (!entity.apiVersion) {
    errors.push('Missing required field: apiVersion');
  } else if (typeof entity.apiVersion !== 'string') {
    errors.push('Field apiVersion must be a string');
  }

  // Validate kind
  if (!entity.kind) {
    errors.push('Missing required field: kind');
  } else if (typeof entity.kind !== 'string') {
    errors.push('Field kind must be a string');
  }

  // Validate metadata
  if (!entity.metadata) {
    errors.push('Missing required field: metadata');
  } else {
    if (typeof entity.metadata !== 'object') {
      errors.push('Field metadata must be an object');
    } else {
      // Validate metadata.name
      if (!entity.metadata.name) {
        errors.push('Missing required field: metadata.name');
      } else if (typeof entity.metadata.name !== 'string') {
        errors.push('Field metadata.name must be a string');
      } else if (!isValidEntityName(entity.metadata.name)) {
        errors.push(
          'Field metadata.name must match pattern: [a-z0-9A-Z] separated by [-_.], length 1-63'
        );
      }

      // Validate optional metadata fields
      if (entity.metadata.namespace !== undefined) {
        if (typeof entity.metadata.namespace !== 'string') {
          errors.push('Field metadata.namespace must be a string');
        } else if (!isValidEntityName(entity.metadata.namespace)) {
          errors.push(
            'Field metadata.namespace must match pattern: [a-z0-9A-Z] separated by [-_.], length 1-63'
          );
        }
      }

      if (entity.metadata.title !== undefined && typeof entity.metadata.title !== 'string') {
        errors.push('Field metadata.title must be a string');
      }

      if (
        entity.metadata.description !== undefined &&
        typeof entity.metadata.description !== 'string'
      ) {
        errors.push('Field metadata.description must be a string');
      }

      if (entity.metadata.labels !== undefined) {
        if (typeof entity.metadata.labels !== 'object' || Array.isArray(entity.metadata.labels)) {
          errors.push('Field metadata.labels must be an object');
        }
      }

      if (entity.metadata.annotations !== undefined) {
        if (
          typeof entity.metadata.annotations !== 'object' ||
          Array.isArray(entity.metadata.annotations)
        ) {
          errors.push('Field metadata.annotations must be an object');
        }
      }

      if (entity.metadata.tags !== undefined) {
        if (!Array.isArray(entity.metadata.tags)) {
          errors.push('Field metadata.tags must be an array');
        } else if (!entity.metadata.tags.every(tag => typeof tag === 'string')) {
          errors.push('All items in metadata.tags must be strings');
        }
      }

      if (entity.metadata.links !== undefined) {
        if (!Array.isArray(entity.metadata.links)) {
          errors.push('Field metadata.links must be an array');
        } else {
          for (const [index, link] of entity.metadata.links.entries()) {
            if (typeof link !== 'object' || link === null) {
              errors.push(`Link at index ${index} must be an object`);
              continue;
            }
            if (!link.url || typeof link.url !== 'string') {
              errors.push(`Link at index ${index} missing required field: url (string)`);
            }
            if (!link.title || typeof link.title !== 'string') {
              errors.push(`Link at index ${index} missing required field: title (string)`);
            }
          }
        }
      }
    }
  }

  // Validate spec
  if (!entity.spec) {
    errors.push('Missing required field: spec');
  } else if (typeof entity.spec !== 'object' || Array.isArray(entity.spec)) {
    errors.push('Field spec must be an object');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Checks if an entity kind is supported by this importer
 */
export const isSupportedKind = (kind: string): boolean => {
  const supportedKinds = ['Component', 'API', 'Resource', 'System', 'Domain'];
  return supportedKinds.includes(kind);
};

/**
 * Validates entity name format according to Backstage rules
 * Must be sequences of [a-z0-9A-Z] separated by [-_.], length 1-63
 */
const isValidEntityName = (name: string): boolean => {
  if (name.length < 1 || name.length > 63) {
    return false;
  }
  return /^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/.test(name);
};

/**
 * Generates a stable external key for a Backstage entity
 * Format: {namespace}/{kind}/{name}
 */
export const generateExternalKey = (entity: BackstageEntity): string => {
  const namespace = entity.metadata.namespace || 'default';
  const kind = entity.kind.toLowerCase();
  const name = entity.metadata.name;
  return `${namespace}/${kind}/${name}`;
};
