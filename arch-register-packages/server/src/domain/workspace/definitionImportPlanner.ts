import { createHash } from 'node:crypto';
import type {
  DefinitionImportDependencyMapping,
  DefinitionImportPreview,
  DefinitionImportRename,
  DefinitionImportSelection,
  DefinitionImportSource,
  TemplateDependencyDescriptor
} from '@arch-register/api-types/workspaceContract';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { isReferenceOrContainmentField } from '@arch-register/api-types/schemaContract';
import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { isEntityRelationField } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceCapabilityBindings } from '@arch-register/api-types/workspaceCapabilityContract';
import { findUnresolvedFieldGroupReferences } from '../catalog/schemaHelpers';
import { validateDerivedFieldGroupAccess } from '../derived/derivedFields';
import type { TemplateDependencyKind } from '../catalog/schemaTemplates';
import type {
  DefinitionImportPlan,
  DefinitionImportTargetState,
  DefinitionSource,
  ImportableSchema,
  PlannedSchemaPatch
} from './definitionImportTypes';

const dependencyReferencePrefix = '__template_dependency__:';
const isDependencyReference = (id: string) => id.startsWith(dependencyReferencePrefix);
const dependencyIdFromReference = (reference: string) =>
  reference.slice(dependencyReferencePrefix.length);
const renameKey = (kind: DefinitionImportRename['kind'], id: string) => `${kind}:${id}`;
const lower = (value: string) => value.toLocaleLowerCase();

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

export const definitionImportFingerprint = (value: unknown) =>
  createHash('sha256').update(stableStringify(value)).digest('hex');

const addUniqueError = (errors: string[], message: string) => {
  if (!errors.includes(message)) errors.push(message);
};

const validateDependencyMappings = (
  source: DefinitionSource,
  mappings: DefinitionImportDependencyMapping[],
  activeDependencyIds: ReadonlySet<string>,
  targetIdsByKind: ReadonlyMap<TemplateDependencyKind, ReadonlySet<string>>,
  errors: string[]
) => {
  const descriptors = new Map(source.dependencies.map(dependency => [dependency.id, dependency]));
  const mappingsById = new Map<string, DefinitionImportDependencyMapping>();
  for (const mapping of mappings) {
    if (mappingsById.has(mapping.dependencyId)) {
      addUniqueError(errors, `Multiple mappings were provided for '${mapping.dependencyId}'`);
      continue;
    }
    mappingsById.set(mapping.dependencyId, mapping);
    if (!descriptors.has(mapping.dependencyId)) {
      addUniqueError(
        errors,
        `Template dependency '${mapping.dependencyId}' is not active in the import source`
      );
    }
  }

  for (const dependencyId of activeDependencyIds) {
    const dependency = descriptors.get(dependencyId);
    if (!dependency) {
      addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
      continue;
    }
    const mapping = mappingsById.get(dependencyId);
    if (!mapping) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' requires a mapping to destination definitions`
      );
      continue;
    }
    if (mapping.targetIds.length < dependency.min_targets) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' requires at least ${dependency.min_targets} target${dependency.min_targets === 1 ? '' : 's'}`
      );
    }
    if (dependency.max_targets !== undefined && mapping.targetIds.length > dependency.max_targets) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' accepts at most ${dependency.max_targets} target${dependency.max_targets === 1 ? '' : 's'}`
      );
    }
    if (new Set(mapping.targetIds).size !== mapping.targetIds.length) {
      addUniqueError(errors, `Template dependency '${dependencyId}' contains duplicate targets`);
    }
    const targetIds = targetIdsByKind.get(dependency.target_kind) ?? new Set<string>();
    for (const targetId of mapping.targetIds) {
      if (!targetIds.has(targetId)) {
        addUniqueError(
          errors,
          `Template dependency '${dependencyId}' targets unknown ${dependency.target_kind} '${targetId}' in the destination workspace`
        );
      }
    }
  }

  return { descriptors, mappingsById };
};

const resolveImportReferenceId = (
  kind: TemplateDependencyKind,
  reference: string,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
) => {
  if (!isDependencyReference(reference)) return reference;
  const dependencyId = dependencyIdFromReference(reference);
  const dependency = descriptors.get(dependencyId);
  if (!dependency) {
    addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
    return reference;
  }
  if (dependency.target_kind !== kind) {
    addUniqueError(
      errors,
      `Template dependency '${dependencyId}' targets ${dependency.target_kind}, not ${kind}`
    );
    return reference;
  }
  const mapping = mappingsById.get(dependencyId);
  if (!mapping) return reference;
  if (mapping.targetIds.length !== 1) {
    addUniqueError(
      errors,
      `Template dependency '${dependencyId}' requires exactly one target for this reference`
    );
    return reference;
  }
  return mapping.targetIds[0]!;
};

const resolveImportReferenceIds = (
  kind: TemplateDependencyKind,
  references: string[],
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
) =>
  references.flatMap(reference => {
    if (!isDependencyReference(reference)) return [reference];
    const dependencyId = dependencyIdFromReference(reference);
    const dependency = descriptors.get(dependencyId);
    if (!dependency) {
      addUniqueError(errors, `Template dependency '${dependencyId}' was not found in the source`);
      return [reference];
    }
    if (dependency.target_kind !== kind) {
      addUniqueError(
        errors,
        `Template dependency '${dependencyId}' targets ${dependency.target_kind}, not ${kind}`
      );
      return [reference];
    }
    const mapping = mappingsById.get(dependencyId);
    return mapping?.targetIds ?? [reference];
  });

const resolveImportField = (
  field: SchemaField,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
): SchemaField => {
  const groupId = field.groupId
    ? resolveImportReferenceId('fieldGroup', field.groupId, mappingsById, descriptors, errors)
    : field.groupId;
  if (isReferenceOrContainmentField(field)) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      schemaId: resolveImportReferenceId(
        'schema',
        field.schemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'typedRelation') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      relationSchemaId: resolveImportReferenceId(
        'relationSchema',
        field.relationSchemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'select') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  if (field.type === 'derived' && field.enumId !== undefined) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  return groupId === undefined ? field : { ...field, groupId };
};

const resolveImportRelationField = (
  field: RelationField,
  mappingsById: ReadonlyMap<string, DefinitionImportDependencyMapping>,
  descriptors: ReadonlyMap<string, TemplateDependencyDescriptor>,
  errors: string[]
): RelationField => {
  const groupId = field.groupId
    ? resolveImportReferenceId('fieldGroup', field.groupId, mappingsById, descriptors, errors)
    : field.groupId;
  if (isEntityRelationField(field)) {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      schemaId: resolveImportReferenceId(
        'schema',
        field.schemaId,
        mappingsById,
        descriptors,
        errors
      )
    };
  }
  if (field.type === 'select') {
    return {
      ...field,
      ...(groupId === undefined ? {} : { groupId }),
      enumId: resolveImportReferenceId('enum', field.enumId, mappingsById, descriptors, errors)
    };
  }
  return groupId === undefined ? field : { ...field, groupId };
};

export type BuildDefinitionImportPlanInput = {
  source: DefinitionImportSource;
  sourceData: DefinitionSource;
  target: DefinitionImportTargetState;
  selection: DefinitionImportSelection;
  renames: DefinitionImportRename[];
  dependencyMappings: DefinitionImportDependencyMapping[];
};

export const buildDefinitionImportPlan = async ({
  source,
  sourceData,
  target,
  selection,
  renames,
  dependencyMappings
}: BuildDefinitionImportPlanInput): Promise<DefinitionImportPlan> => {
  const errors: string[] = [];
  const renameByKey = new Map<string, string>();
  for (const rename of renames) {
    const key = renameKey(rename.kind, rename.id);
    if (renameByKey.has(key))
      errors.push(`Multiple rename requests were provided for '${rename.id}'`);
    else renameByKey.set(key, rename.name.trim());
  }
  const selectedSchemaIds = new Set(selection.schemas);
  const selectedEnumIds = new Set(selection.enums);
  const selectedDocumentTypeIds = new Set(selection.documentTypes);
  const selectedRelationSchemaIds = new Set(selection.relationSchemas);
  const selectedFieldGroupIds = new Set(selection.fieldGroups);
  if (
    selectedSchemaIds.size +
      selectedEnumIds.size +
      selectedDocumentTypeIds.size +
      selectedRelationSchemaIds.size +
      selectedFieldGroupIds.size ===
    0
  ) {
    errors.push(
      'Select at least one schema, enum, active document type, relation schema, or field group'
    );
  }

  const schemaById = new Map(
    sourceData.schemas.map(schema => [
      schema.id,
      { ...schema, name: renameByKey.get(renameKey('schema', schema.id)) ?? schema.name }
    ])
  );
  const enumById = new Map(
    sourceData.enums.map(enumeration => [
      enumeration.id,
      {
        ...enumeration,
        name: renameByKey.get(renameKey('enum', enumeration.id)) ?? enumeration.name
      }
    ])
  );
  const documentTypeById = new Map(
    sourceData.documentTypes.map(type => [
      type.id,
      { ...type, name: renameByKey.get(renameKey('documentType', type.id)) ?? type.name }
    ])
  );
  const relationSchemaById = new Map(
    sourceData.relationSchemas.map(schema => [
      schema.id,
      { ...schema, name: renameByKey.get(renameKey('relationSchema', schema.id)) ?? schema.name }
    ])
  );
  const fieldGroupById = new Map(
    sourceData.fieldGroups.map(group => [
      group.id,
      { ...group, name: renameByKey.get(renameKey('fieldGroup', group.id)) ?? group.name }
    ])
  );
  for (const rename of renames) {
    const known =
      (rename.kind === 'schema' && schemaById.has(rename.id)) ||
      (rename.kind === 'enum' && enumById.has(rename.id)) ||
      (rename.kind === 'documentType' && documentTypeById.has(rename.id)) ||
      (rename.kind === 'relationSchema' && relationSchemaById.has(rename.id)) ||
      (rename.kind === 'fieldGroup' && fieldGroupById.has(rename.id));
    if (!known) errors.push(`Cannot rename unknown ${rename.kind} '${rename.id}'`);
  }

  const resolvedSchemaIds = new Set<string>();
  const resolvedRelationSchemaIds = new Set<string>();
  const resolvedEnumIds = new Set(selectedEnumIds);
  const schemaQueue = [...selectedSchemaIds];
  const relationSchemaQueue = [...selectedRelationSchemaIds];
  do {
    while (schemaQueue.length > 0) {
      const schemaId = schemaQueue.shift()!;
      if (resolvedSchemaIds.has(schemaId)) continue;
      const schema = schemaById.get(schemaId);
      if (!schema) {
        errors.push(`Schema '${schemaId}' was not found in the source`);
        continue;
      }
      resolvedSchemaIds.add(schemaId);
      for (const field of schema.fields) {
        if (isReferenceOrContainmentField(field)) {
          if (!isDependencyReference(field.schemaId) && !schemaById.has(field.schemaId))
            errors.push(`Schema '${schema.name}' references missing schema '${field.schemaId}'`);
          else if (!isDependencyReference(field.schemaId)) schemaQueue.push(field.schemaId);
        } else if (field.type === 'typedRelation') {
          if (
            !isDependencyReference(field.relationSchemaId) &&
            !relationSchemaById.has(field.relationSchemaId)
          ) {
            errors.push(
              `Schema '${schema.name}' references missing relation schema '${field.relationSchemaId}'`
            );
          } else if (!isDependencyReference(field.relationSchemaId))
            relationSchemaQueue.push(field.relationSchemaId);
        } else if (field.type === 'select') {
          if (!isDependencyReference(field.enumId) && !enumById.has(field.enumId))
            errors.push(`Schema '${schema.name}' references missing enum '${field.enumId}'`);
          else if (!isDependencyReference(field.enumId)) resolvedEnumIds.add(field.enumId);
        }
      }
    }
    while (relationSchemaQueue.length > 0) {
      const relationSchemaId = relationSchemaQueue.shift()!;
      if (resolvedRelationSchemaIds.has(relationSchemaId)) continue;
      const relationSchema = relationSchemaById.get(relationSchemaId);
      if (!relationSchema) {
        errors.push(`Relation schema '${relationSchemaId}' was not found in the source`);
        continue;
      }
      resolvedRelationSchemaIds.add(relationSchemaId);
      for (const schemaId of [
        ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
        ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
      ]) {
        if (!isDependencyReference(schemaId) && !schemaById.has(schemaId))
          errors.push(
            `Relation schema '${relationSchema.name}' references missing schema '${schemaId}'`
          );
        else if (!isDependencyReference(schemaId)) schemaQueue.push(schemaId);
      }
      for (const field of relationSchema.fields) {
        if (isEntityRelationField(field)) {
          if (!isDependencyReference(field.schemaId) && !schemaById.has(field.schemaId))
            errors.push(
              `Relation schema '${relationSchema.name}' references missing schema '${field.schemaId}'`
            );
          else if (!isDependencyReference(field.schemaId)) schemaQueue.push(field.schemaId);
        } else if (field.type === 'select') {
          if (!isDependencyReference(field.enumId) && !enumById.has(field.enumId))
            errors.push(
              `Relation schema '${relationSchema.name}' references missing enum '${field.enumId}'`
            );
          else if (!isDependencyReference(field.enumId)) resolvedEnumIds.add(field.enumId);
        }
      }
    }
  } while (schemaQueue.length > 0 || relationSchemaQueue.length > 0);

  for (const enumId of resolvedEnumIds) {
    if (!enumById.has(enumId)) errors.push(`Enum '${enumId}' was not found in the source`);
  }
  for (const documentTypeId of selectedDocumentTypeIds) {
    if (!documentTypeById.has(documentTypeId))
      errors.push(`Active document type '${documentTypeId}' was not found in the source`);
  }
  for (const fieldGroupId of selectedFieldGroupIds) {
    if (!fieldGroupById.has(fieldGroupId))
      errors.push(`Field group '${fieldGroupId}' was not found in the source`);
  }

  const schemas = [...schemaById.values()].filter(schema => resolvedSchemaIds.has(schema.id));
  const enums = [...enumById.values()].filter(enumeration => resolvedEnumIds.has(enumeration.id));
  const documentTypes = [...documentTypeById.values()].filter(type =>
    selectedDocumentTypeIds.has(type.id)
  );
  const relationSchemas = [...relationSchemaById.values()].filter(schema =>
    resolvedRelationSchemaIds.has(schema.id)
  );
  const fieldGroups = [...fieldGroupById.values()].filter(group =>
    selectedFieldGroupIds.has(group.id)
  );
  const capabilityConfigurations = sourceData.capabilityConfigurations.filter(configuration =>
    Object.values(configuration.bindings).every(binding => {
      switch (binding.target.kind) {
        case 'entity_schema':
          return resolvedSchemaIds.has(binding.target.id);
        case 'relation_schema':
          return resolvedRelationSchemaIds.has(binding.target.id);
        case 'document_type':
          return selectedDocumentTypeIds.has(binding.target.id);
      }
    })
  );

  for (const schema of schemas) {
    const unresolved = findUnresolvedFieldGroupReferences(schema.fields, schema.groups);
    if (unresolved.length > 0) {
      errors.push(
        ...unresolved.map(
          reference =>
            `Schema '${schema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
        )
      );
      continue;
    }
    try {
      validateDerivedFieldGroupAccess(schema.fields, schema.groups);
    } catch (error) {
      errors.push(
        error instanceof Error ? `Schema '${schema.name}': ${error.message}` : String(error)
      );
    }
  }
  for (const relationSchema of relationSchemas) {
    const unresolved = findUnresolvedFieldGroupReferences(
      relationSchema.fields,
      relationSchema.groups
    );
    if (unresolved.length > 0) {
      errors.push(
        ...unresolved.map(
          reference =>
            `Relation schema '${relationSchema.name}' field '${reference.fieldName}' references missing field group '${reference.groupId}'`
        )
      );
      continue;
    }
    try {
      validateDerivedFieldGroupAccess(relationSchema.fields, relationSchema.groups, 'relation');
    } catch (error) {
      errors.push(
        error instanceof Error
          ? `Relation schema '${relationSchema.name}': ${error.message}`
          : String(error)
      );
    }
  }

  const activeDependencyIds = new Set<string>();
  const collectDependencyReference = (reference: string) => {
    if (isDependencyReference(reference))
      activeDependencyIds.add(dependencyIdFromReference(reference));
  };
  const collectSchemaFieldDependencies = (field: SchemaField) => {
    collectDependencyReference(field.groupId ?? '');
    if (isReferenceOrContainmentField(field)) collectDependencyReference(field.schemaId);
    else if (field.type === 'typedRelation') collectDependencyReference(field.relationSchemaId);
    else if (field.type === 'select') collectDependencyReference(field.enumId);
    else if (field.type === 'derived' && field.enumId !== undefined)
      collectDependencyReference(field.enumId);
  };
  const collectRelationFieldDependencies = (field: RelationField) => {
    collectDependencyReference(field.groupId ?? '');
    if (isEntityRelationField(field)) collectDependencyReference(field.schemaId);
    else if (field.type === 'select') collectDependencyReference(field.enumId);
  };
  for (const schema of schemas) {
    for (const field of schema.fields) collectSchemaFieldDependencies(field);
    for (const link of schema.shared_field_group_links) collectDependencyReference(link.groupId);
  }
  for (const relationSchema of relationSchemas) {
    for (const schemaId of [
      ...(relationSchema.in_schema_ids === 'any' ? [] : relationSchema.in_schema_ids),
      ...(relationSchema.out_schema_ids === 'any' ? [] : relationSchema.out_schema_ids)
    ])
      collectDependencyReference(schemaId);
    for (const field of relationSchema.fields) collectRelationFieldDependencies(field);
    for (const link of relationSchema.shared_field_group_links)
      collectDependencyReference(link.groupId);
  }
  for (const fieldGroup of fieldGroups) {
    for (const field of fieldGroup.fields) collectSchemaFieldDependencies(field);
  }
  const isSelectedDefinition = (definition: TemplateDependencyDescriptor['required_by'][number]) =>
    definition.kind === 'schema'
      ? resolvedSchemaIds.has(definition.id)
      : definition.kind === 'relationSchema'
        ? resolvedRelationSchemaIds.has(definition.id)
        : definition.kind === 'enum'
          ? resolvedEnumIds.has(definition.id)
          : definition.kind === 'fieldGroup'
            ? selectedFieldGroupIds.has(definition.id)
            : selectedDocumentTypeIds.has(definition.id);
  const activeExtensionOwners = new Set(
    sourceData.dependencies
      .filter(dependency => dependency.required_by.some(isSelectedDefinition))
      .map(dependency => dependency.owner_id)
  );
  for (const patch of sourceData.schemaPatches) {
    if (!activeExtensionOwners.has(patch.ownerId)) continue;
    collectDependencyReference(patch.target);
    for (const field of patch.fields) collectSchemaFieldDependencies(field);
  }

  const targetIdsByKind = new Map<TemplateDependencyKind, ReadonlySet<string>>([
    ['schema', new Set(target.schemas.map(schema => schema.id))],
    ['enum', new Set(target.enums.map(enumeration => enumeration.id))],
    ['documentType', new Set(target.documentTypes.map(documentType => documentType.id))],
    ['relationSchema', new Set(target.relationSchemas.map(schema => schema.id))],
    ['fieldGroup', new Set(target.fieldGroups.map(group => group.id))]
  ]);
  const { descriptors, mappingsById } = validateDependencyMappings(
    sourceData,
    dependencyMappings,
    activeDependencyIds,
    targetIdsByKind,
    errors
  );

  const mappedSchemas = schemas.map(schema => ({
    ...schema,
    fields: schema.fields.map(field =>
      resolveImportField(field, mappingsById, descriptors, errors)
    ),
    shared_field_group_links: schema.shared_field_group_links.flatMap(link =>
      resolveImportReferenceIds(
        'fieldGroup',
        [link.groupId],
        mappingsById,
        descriptors,
        errors
      ).map(groupId => ({ ...link, groupId }))
    )
  }));
  const mappedRelationSchemas = relationSchemas.map(relationSchema => ({
    ...relationSchema,
    in_schema_ids:
      relationSchema.in_schema_ids === 'any'
        ? ('any' as const)
        : resolveImportReferenceIds(
            'schema',
            relationSchema.in_schema_ids,
            mappingsById,
            descriptors,
            errors
          ),
    out_schema_ids:
      relationSchema.out_schema_ids === 'any'
        ? ('any' as const)
        : resolveImportReferenceIds(
            'schema',
            relationSchema.out_schema_ids,
            mappingsById,
            descriptors,
            errors
          ),
    fields: relationSchema.fields.map(field =>
      resolveImportRelationField(field, mappingsById, descriptors, errors)
    ),
    shared_field_group_links: relationSchema.shared_field_group_links.flatMap(link =>
      resolveImportReferenceIds(
        'fieldGroup',
        [link.groupId],
        mappingsById,
        descriptors,
        errors
      ).map(groupId => ({ ...link, groupId }))
    )
  }));
  const mappedFieldGroups = fieldGroups.map(group => ({
    ...group,
    fields: group.fields.map(field => resolveImportField(field, mappingsById, descriptors, errors))
  }));
  const mappedCapabilityConfigurations = capabilityConfigurations.map(configuration => ({
    ...configuration,
    bindings: Object.fromEntries(
      Object.entries(configuration.bindings).map(([bindingId, binding]) => {
        const kind =
          binding.target.kind === 'entity_schema'
            ? 'schema'
            : binding.target.kind === 'relation_schema'
              ? 'relationSchema'
              : 'documentType';
        return [
          bindingId,
          {
            ...binding,
            target: {
              ...binding.target,
              id: resolveImportReferenceId(
                kind,
                binding.target.id,
                mappingsById,
                descriptors,
                errors
              )
            }
          }
        ];
      })
    ) as WorkspaceCapabilityBindings
  }));

  const existingSchemaById = new Map(target.schemas.map(schema => [schema.id, schema]));
  const schemaPatches: PlannedSchemaPatch[] = [];
  for (const patch of sourceData.schemaPatches) {
    if (!activeExtensionOwners.has(patch.ownerId)) continue;
    const targetSchemaIds = resolveImportReferenceIds(
      'schema',
      [patch.target],
      mappingsById,
      descriptors,
      errors
    );
    for (const targetSchemaId of targetSchemaIds) {
      const targetSchema =
        existingSchemaById.get(targetSchemaId) ??
        mappedSchemas.find(schema => schema.id === targetSchemaId);
      if (!targetSchema) {
        addUniqueError(
          errors,
          `Schema patch target '${targetSchemaId}' was not found in the source or destination`
        );
        continue;
      }
      const fields = patch.fields.map(field =>
        resolveImportField(field, mappingsById, descriptors, errors)
      );
      const existingFieldIds = new Set(targetSchema.fields.map(field => field.id));
      const patchFieldIds = new Set<string>();
      for (const field of fields) {
        if (existingFieldIds.has(field.id) || patchFieldIds.has(field.id))
          addUniqueError(
            errors,
            `Schema patch '${targetSchema.name}' adds duplicate field '${field.id}'`
          );
        patchFieldIds.add(field.id);
      }
      schemaPatches.push({ targetSchemaId, targetSchemaName: targetSchema.name, fields });
    }
  }

  const conflicts: DefinitionImportPlan['conflicts'] = [];
  const checkNames = (
    kind: DefinitionImportPlan['conflicts'][number]['kind'],
    items: Array<{ id: string; name: string }>,
    existing: Array<{ name: string }>
  ) => {
    const existingNames = new Map(existing.map(item => [lower(item.name), item.name]));
    const seen = new Set<string>();
    for (const item of items) {
      const key = lower(item.name);
      if (seen.has(key))
        conflicts.push({ kind, id: item.id, name: item.name, existingName: item.name });
      const existingName = existingNames.get(key);
      if (existingName) conflicts.push({ kind, id: item.id, name: item.name, existingName });
      seen.add(key);
    }
  };
  checkNames('schema', mappedSchemas, target.schemas);
  checkNames('enum', enums, target.enums);
  checkNames('documentType', documentTypes, target.documentTypes);
  checkNames('relationSchema', mappedRelationSchemas, target.relationSchemas);
  checkNames('fieldGroup', mappedFieldGroups, target.fieldGroups);

  const usedPrefixes = new Set(target.schemas.map(schema => lower(schema.key_prefix)));
  const keyPrefixRemaps: DefinitionImportPlan['keyPrefixRemaps'] = [];
  const resolvedSchemas: ImportableSchema[] = [];
  for (const schema of mappedSchemas) {
    const original = schema.key_prefix;
    let next = original;
    const isPrefixUsed = async (prefix: string) =>
      usedPrefixes.has(lower(prefix)) || (await target.isSchemaKeyPrefixUsed(prefix));
    if (await isPrefixUsed(next)) {
      let attempt = 0;
      do {
        next = createHash('sha1')
          .update(`${source.kind}:${source.id}:${schema.id}:${attempt++}`)
          .digest('hex')
          .slice(0, 5)
          .toUpperCase();
      } while (await isPrefixUsed(next));
      keyPrefixRemaps.push({ sourceId: schema.id, name: schema.name, from: original, to: next });
    }
    usedPrefixes.add(lower(next));
    resolvedSchemas.push({ ...schema, key_prefix: next });
  }

  const fingerprintPayload = {
    source,
    selection,
    renames,
    schemas: resolvedSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      dependency: !selectedSchemaIds.has(schema.id),
      definition: schema
    })),
    enums: enums.map(enumeration => ({
      id: enumeration.id,
      name: enumeration.name,
      dependency: !selectedEnumIds.has(enumeration.id),
      definition: enumeration
    })),
    documentTypes: documentTypes.map(documentType => ({
      id: documentType.id,
      name: documentType.name,
      dependency: false,
      definition: documentType
    })),
    relationSchemas: mappedRelationSchemas.map(schema => ({
      id: schema.id,
      name: schema.name,
      dependency: !selectedRelationSchemaIds.has(schema.id),
      definition: schema
    })),
    fieldGroups: mappedFieldGroups.map(group => ({
      id: group.id,
      name: group.name,
      dependency: false,
      definition: group
    })),
    capabilityConfigurations: mappedCapabilityConfigurations,
    dependencyMappings,
    schemaPatches,
    schemaPatchTargets: schemaPatches.map(patch => ({
      targetSchemaId: patch.targetSchemaId,
      current: existingSchemaById.get(patch.targetSchemaId)
        ? {
            version: existingSchemaById.get(patch.targetSchemaId)!.version,
            fields: existingSchemaById.get(patch.targetSchemaId)!.fields
          }
        : null
    })),
    dashboardWidgets: selection.dashboard ? sourceData.dashboardWidgets : [],
    keyPrefixRemaps,
    errors,
    conflicts
  };

  return {
    source,
    selection,
    renames,
    schemas: resolvedSchemas,
    enums,
    documentTypes,
    relationSchemas: mappedRelationSchemas,
    fieldGroups: mappedFieldGroups,
    capabilityConfigurations: mappedCapabilityConfigurations,
    dependencyMappings,
    schemaPatches,
    dashboardWidgets: selection.dashboard ? sourceData.dashboardWidgets : [],
    conflicts,
    keyPrefixRemaps,
    errors,
    fingerprint: definitionImportFingerprint(fingerprintPayload),
    sourceTeamNames: sourceData.teamNames
  };
};

export const definitionImportPlanToPreview = (
  plan: DefinitionImportPlan
): DefinitionImportPreview => ({
  source: plan.source,
  selection: plan.selection,
  renames: plan.renames,
  schemas: plan.schemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    dependency: !plan.selection.schemas.includes(schema.id),
    definition: schema
  })),
  enums: plan.enums.map(enumeration => ({
    id: enumeration.id,
    name: enumeration.name,
    dependency: !plan.selection.enums.includes(enumeration.id),
    definition: enumeration
  })),
  documentTypes: plan.documentTypes.map(documentType => ({
    id: documentType.id,
    name: documentType.name,
    dependency: false,
    definition: documentType
  })),
  relationSchemas: plan.relationSchemas.map(schema => ({
    id: schema.id,
    name: schema.name,
    dependency: !plan.selection.relationSchemas.includes(schema.id),
    definition: schema
  })),
  fieldGroups: plan.fieldGroups.map(group => ({
    id: group.id,
    name: group.name,
    dependency: false,
    definition: group
  })),
  dashboardWidgets: plan.dashboardWidgets,
  dependencyMappings: plan.dependencyMappings,
  schemaPatches: plan.schemaPatches,
  conflicts: plan.conflicts,
  keyPrefixRemaps: plan.keyPrefixRemaps,
  errors: plan.errors,
  fingerprint: plan.fingerprint
});

export { stableStringify };
