import type { EntitySchema, WorkspaceEnum } from '@arch-register/api-types';
import type {
  EntitySchema as InternalEntitySchema,
  WorkspaceEnum as InternalWorkspaceEnum
} from '../../types';

export const toApiEnum = (e: InternalWorkspaceEnum): WorkspaceEnum => ({
  id: e.id,
  workspace: e.workspace,
  name: e.name,
  options: e.options,
  sort_order: e.sort_order,
  created_at: e.created_at.toISOString(),
  updated_at: e.updated_at.toISOString()
});

export const toApiSchema = (
  schema: InternalEntitySchema,
  entityCount: number,
  enums: InternalWorkspaceEnum[]
): EntitySchema => {
  const enumMap = new Map(enums.map(e => [e.id, e]));
  const fields = schema.fields.map(field => {
    if (field.type === 'select') {
      const enumDef = enumMap.get(field.enumId);
      return {
        ...field,
        options: enumDef?.options ?? []
      };
    }
    return field;
  });
  return {
    id: schema.id,
    workspace: schema.workspace,
    name: schema.name,
    description: schema.description,
    fields,
    color: schema.color,
    icon: schema.icon,
    entity_count: entityCount,
    created_at: schema.created_at.toISOString(),
    updated_at: schema.updated_at.toISOString()
  };
};
