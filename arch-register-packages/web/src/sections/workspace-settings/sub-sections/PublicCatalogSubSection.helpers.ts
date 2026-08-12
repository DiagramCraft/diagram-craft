import type {
  PublicCatalogConfig,
  PublicCatalogSelectorOptions
} from '@arch-register/api-types/publicCatalogContract';

export type PublicCatalogDraftValidation = {
  errors: string[];
  schemaErrors: Record<number, string[]>;
  entityOverrideErrors: Record<number, string[]>;
  pageErrors: Record<number, string[]>;
  apiArtifactErrors: Record<number, string[]>;
};

const addError = (target: Record<number, string[]>, index: number, message: string) => {
  target[index] = [...(target[index] ?? []), message];
};

export const normalizePublicPath = (value: string) =>
  value.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '');

export const publicPathFromNodePath = (value: string) =>
  normalizePublicPath(value).replace(/\.(?:md|mdx)$/i, '');

export const selectorEntityByIdentifier = (
  options: PublicCatalogSelectorOptions,
  identifier: string | undefined
) => {
  if (!identifier) return undefined;
  return options.entities.find(
    entity => entity.id === identifier || entity.publicId === identifier
  );
};

export const selectorArtifactById = (
  options: PublicCatalogSelectorOptions,
  artifactId: string | undefined
) => options.apiArtifacts.find(artifact => artifact.artifactId === artifactId);

export const isDraftEntityPublished = (
  config: PublicCatalogConfig,
  options: PublicCatalogSelectorOptions,
  identifier: string | undefined
) => {
  const entity = selectorEntityByIdentifier(options, identifier);
  if (!entity?.selectable) return false;
  const override = config.entityOverrides.find(
    item => item.entityId === entity.id || item.entityId === entity.publicId
  );
  if (override?.mode === 'exclude') return false;
  return (
    override?.mode === 'publish' || config.schemas.some(item => item.schemaId === entity.schemaId)
  );
};

export const validatePublicCatalogDraft = (
  config: PublicCatalogConfig,
  options: PublicCatalogSelectorOptions
): PublicCatalogDraftValidation => {
  const validation: PublicCatalogDraftValidation = {
    errors: [],
    schemaErrors: {},
    entityOverrideErrors: {},
    pageErrors: {},
    apiArtifactErrors: {}
  };

  const schemasById = new Map(options.schemas.map(schema => [schema.id, schema]));
  const schemaIds = new Set<string>();
  for (const [index, publication] of config.schemas.entries()) {
    const errors: string[] = [];
    if (schemaIds.has(publication.schemaId)) errors.push('Schema is selected more than once.');
    schemaIds.add(publication.schemaId);
    const schema = schemasById.get(publication.schemaId);
    if (!schema) {
      errors.push('This schema is no longer available. Remove it or choose another schema.');
    } else {
      const fieldIds = new Set<string>();
      for (const fieldId of publication.fieldIds) {
        if (fieldIds.has(fieldId)) errors.push(`Field '${fieldId}' is selected more than once.`);
        fieldIds.add(fieldId);
        const field = schema.fields.find(candidate => candidate.id === fieldId);
        if (!field) errors.push(`Field '${fieldId}' is no longer available.`);
        else if (!field.selectable) errors.push(field.reason ?? 'This field cannot be published.');
      }
    }
    if (errors.length > 0) validation.schemaErrors[index] = errors;
  }

  const entityOverridesByIdentifier = new Map<string, number>();
  for (const [index, override] of config.entityOverrides.entries()) {
    const errors: string[] = [];
    const previousIndex = entityOverridesByIdentifier.get(override.entityId);
    if (previousIndex != null) {
      errors.push('Entity override is selected more than once.');
      addError(validation.entityOverrideErrors, previousIndex, 'Entity override is duplicated.');
    }
    entityOverridesByIdentifier.set(override.entityId, index);

    const entity = selectorEntityByIdentifier(options, override.entityId);
    if (!entity) {
      errors.push('This entity is no longer available. Remove it or choose another entity.');
    } else {
      if (!entity.selectable) errors.push(entity.reason ?? 'This entity cannot be published.');
      if (override.fieldIds) {
        const schema = schemasById.get(entity.schemaId);
        const fieldIds = new Set<string>();
        for (const fieldId of override.fieldIds) {
          if (fieldIds.has(fieldId)) errors.push(`Field '${fieldId}' is selected more than once.`);
          fieldIds.add(fieldId);
          const field = schema?.fields.find(candidate => candidate.id === fieldId);
          if (!field) errors.push(`Field '${fieldId}' is not available for this entity.`);
          else if (!field.selectable)
            errors.push(field.reason ?? 'This field cannot be published.');
        }
      }
    }
    if (errors.length > 0) validation.entityOverrideErrors[index] = errors;
  }

  const publishedEntity = (identifier: string | undefined) =>
    isDraftEntityPublished(config, options, identifier);

  const pagePaths = new Map<string, number>();
  const pageNodeIds = new Map<string, number>();
  for (const [index, page] of config.pages.entries()) {
    const errors: string[] = [];
    const path = normalizePublicPath(page.publicPath);
    const previousPathIndex = pagePaths.get(path);
    if (previousPathIndex != null) {
      errors.push('Public path is used more than once.');
      addError(validation.pageErrors, previousPathIndex, 'Public path is duplicated.');
    }
    pagePaths.set(path, index);
    const previousNodeIndex = pageNodeIds.get(page.nodeId);
    if (previousNodeIndex != null) {
      errors.push('Content page is selected more than once.');
      addError(validation.pageErrors, previousNodeIndex, 'Content page is duplicated.');
    }
    pageNodeIds.set(page.nodeId, index);

    if (!/^[A-Za-z0-9][A-Za-z0-9/_-]*$/.test(page.publicPath) || page.publicPath.length > 200) {
      errors.push('Use a path beginning with a letter or number; /, _, and - are allowed.');
    }
    const candidate = options.pages.find(option => option.nodeId === page.nodeId);
    if (!candidate) {
      errors.push('This Markdown page is no longer available. Remove it or choose another page.');
    } else {
      if (!candidate.selectable) errors.push(candidate.reason ?? 'This page cannot be published.');
      if (candidate.scope !== page.scope)
        errors.push('Page scope does not match the selected node.');
      if (page.scope === 'workspace' && candidate.entityId != null) {
        errors.push('Workspace pages must belong to the workspace content scope.');
      }
      if (page.scope === 'entity') {
        if (!page.entityId) errors.push('Choose the entity that owns this page.');
        else if (!publishedEntity(page.entityId)) {
          errors.push('Publish the owning entity before publishing its wiki page.');
        }
        if (
          page.entityId &&
          candidate.entityId !== page.entityId &&
          candidate.entityPublicId !== page.entityId
        ) {
          errors.push('The selected page does not belong to the selected entity.');
        }
      }
    }
    if (errors.length > 0) validation.pageErrors[index] = errors;
  }

  const artifactIds = new Set<string>();
  for (const [index, publication] of config.apiArtifacts.entries()) {
    const errors: string[] = [];
    if (artifactIds.has(publication.artifactId))
      errors.push('API artifact is selected more than once.');
    artifactIds.add(publication.artifactId);
    const artifact = selectorArtifactById(options, publication.artifactId);
    if (!artifact) {
      errors.push(
        'This API artifact is no longer available. Remove it or choose another artifact.'
      );
    } else {
      if (!artifact.selectable)
        errors.push(artifact.reason ?? 'This API artifact cannot be published.');
      if (!publishedEntity(artifact.entityId) && !publishedEntity(artifact.entityPublicId)) {
        errors.push('Publish the owning entity before publishing its API artifact.');
      }
      const revisionId = publication.revisionId ?? artifact.currentRevisionId;
      if (!revisionId) {
        errors.push('Choose a normalized API revision.');
      } else {
        const revision = artifact.revisions.find(candidate => candidate.revision.id === revisionId);
        if (!revision) errors.push('The selected API revision is no longer available.');
        else if (!revision.selectable) {
          errors.push(revision.reason ?? 'This API revision cannot be published.');
        }
      }
    }
    if (errors.length > 0) validation.apiArtifactErrors[index] = errors;
  }

  for (const errors of Object.values(validation.schemaErrors)) validation.errors.push(...errors);
  for (const errors of Object.values(validation.entityOverrideErrors))
    validation.errors.push(...errors);
  for (const errors of Object.values(validation.pageErrors)) validation.errors.push(...errors);
  for (const errors of Object.values(validation.apiArtifactErrors))
    validation.errors.push(...errors);
  return validation;
};
