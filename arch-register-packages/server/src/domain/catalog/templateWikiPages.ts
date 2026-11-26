import { createHash } from 'node:crypto';
import {
  SCHEMA_TEMPLATES,
  type SchemaTemplate,
  type SymbolicField,
  type SymbolicReference,
  type SymbolicRelationSchema,
  type TemplateSchema
} from './schemaTemplates';

/** Top-level content folder holding the data model documentation. */
export const DATA_MODEL_FOLDER_PATH = 'data-model';

export type TemplateWikiNode = {
  id: string;
  parentId: string | null;
  path: string;
  name: string;
  type: 'folder' | 'markdown';
  body?: string;
};

export type TemplateWikiOptions = {
  workspaceId: string;
  /** Template ids, in the order they should be listed. Unknown ids (e.g. 'blank') are ignored. */
  templateIds: readonly string[];
};

/** Deterministic UUID, so re-instantiating a template in the same workspace yields the same ids. */
const stableId = (workspaceId: string, key: string): string => {
  const hex = createHash('sha1').update(`${workspaceId}:wiki:${key}`).digest('hex');
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
};

const cell = (value: string | undefined): string =>
  (value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const findSchema = (templateId: string, symId: string): TemplateSchema | undefined =>
  SCHEMA_TEMPLATES.find(t => t.id === templateId)?.schemas.find(x => x.symId === symId);

/** The display name of the schema a symbolic reference points at. */
const schemaName = (reference: SymbolicReference, template: SchemaTemplate): string => {
  if (typeof reference === 'string') {
    return template.schemas.find(s => s.symId === reference)?.name ?? reference;
  }
  if ('dependencyId' in reference) {
    return (
      template.dependencies?.find(d => d.id === reference.dependencyId)?.name ??
      reference.dependencyId
    );
  }
  return findSchema(reference.templateId, reference.symId)?.name ?? reference.symId;
};

/** True when the reference points at `schema` of `template`. */
const refersTo = (
  reference: SymbolicReference,
  template: SchemaTemplate,
  schema: TemplateSchema
): boolean =>
  typeof reference === 'string'
    ? reference === schema.symId
    : 'symId' in reference &&
      reference.templateId === template.id &&
      reference.symId === schema.symId;

const bold = (names: string[]): string => names.map(n => `**${n}**`).join(' or ');

const endpointNames = (refs: SymbolicReference[] | 'any', template: SchemaTemplate): string[] =>
  refs === 'any' ? ['any schema'] : refs.map(ref => schemaName(ref, template));

const cardinality = (min: number, max: number): string => {
  if (max === 1) return min >= 1 ? 'exactly one' : 'at most one';
  if (max < 0) return min >= 1 ? 'one or more' : 'any number of';
  return min === max ? `exactly ${min}` : `${min} to ${max}`;
};

type StructuralField = Extract<SymbolicField, { type: 'reference' | 'containment' }>;

const structuralFields = (schema: TemplateSchema): StructuralField[] =>
  schema.fields.filter(
    (field): field is StructuralField => field.type === 'reference' || field.type === 'containment'
  );

/** "provided by" reads as "is provided by"; verbs such as "belongs to" are used as is. */
const defaultPredicate = (field: StructuralField): string => {
  const predicate = field.predicate ?? (field.type === 'containment' ? 'belongs to' : 'references');
  return /^\w+ed by$/.test(predicate) ? `is ${predicate}` : predicate;
};

const withArticle = (name: string): string => `${/^[aeiou]/i.test(name) ? 'An' : 'A'} **${name}**`;

/** "A Component *belongs to* exactly one System." */
const structuralStatement = (
  template: SchemaTemplate,
  schema: TemplateSchema,
  field: StructuralField
): string => {
  const target = schemaName(field.symSchemaId, template);
  const card = cardinality(field.minCount, field.maxCount);
  const object = field.maxCount === 1 ? `**${target}**` : `**${target}** entities`;
  return `${withArticle(schema.name)} *${defaultPredicate(field)}* ${card} ${object} (field: ${field.name}).`;
};

/** "**Component** or **System** → *Provides APIs* → **API**" */
const relationSummary = (template: SchemaTemplate, relation: SymbolicRelationSchema): string =>
  `${bold(endpointNames(relation.inSymSchemaIds, template))} → *${relation.inLabel}* → ${bold(endpointNames(relation.outSymSchemaIds, template))} (**${relation.name}**)`;

const relationsInvolving = (
  template: SchemaTemplate,
  schema: TemplateSchema
): SymbolicRelationSchema[] =>
  (template.relationSchemas ?? []).filter(relation => {
    const touches = (ids: SymbolicReference[] | 'any') =>
      ids !== 'any' && ids.some(id => refersTo(id, template, schema));
    return touches(relation.inSymSchemaIds) || touches(relation.outSymSchemaIds);
  });

const relationshipsSection = (template: SchemaTemplate, schema: TemplateSchema): string[] => {
  const outgoing = structuralFields(schema).map(field =>
    structuralStatement(template, schema, field)
  );
  const composedOf: string[] = [];
  const referencedBy: string[] = [];
  for (const other of template.schemas) {
    if (other === schema) continue;
    for (const field of structuralFields(other)) {
      if (!refersTo(field.symSchemaId, template, schema)) continue;
      if (field.type === 'containment') {
        composedOf.push(
          `${withArticle(schema.name)} is composed of **${other.name}** entities — each ${other.name} *${defaultPredicate(field)}* ${cardinality(field.minCount, field.maxCount)} ${schema.name}.`
        );
      } else {
        referencedBy.push(structuralStatement(template, other, field));
      }
    }
  }

  const typed: string[] = [];
  for (const relation of relationsInvolving(template, schema)) {
    const isSource =
      relation.inSymSchemaIds !== 'any' &&
      relation.inSymSchemaIds.some(id => refersTo(id, template, schema));
    const isTarget =
      relation.outSymSchemaIds !== 'any' &&
      relation.outSymSchemaIds.some(id => refersTo(id, template, schema));
    if (isSource) {
      typed.push(
        `*${relation.inLabel}* → ${bold(endpointNames(relation.outSymSchemaIds, template))} (via the **${relation.name}** relation)`
      );
    }
    if (isTarget) {
      typed.push(
        `*${relation.outLabel}* ← ${bold(endpointNames(relation.inSymSchemaIds, template))} (via the **${relation.name}** relation)`
      );
    }
  }

  const lines: string[] = [];
  const list = (title: string, items: string[]) => {
    if (items.length === 0) return;
    lines.push(`### ${title}`, '', ...items.map(item => `- ${item}`), '');
  };
  list('Structure', [...outgoing, ...composedOf]);
  list('Referenced by', referencedBy);
  list('Relations to other entities', typed);
  return lines.length > 0 ? ['## Relationships', '', ...lines] : [];
};

const fieldTypeLabel = (field: SymbolicField, template: SchemaTemplate): string => {
  switch (field.type) {
    case 'select': {
      const id = typeof field.enumId === 'string' ? field.enumId : undefined;
      const enumName = template.enums.find(e => e.id === id)?.name;
      return enumName ? `select (${enumName})` : 'select';
    }
    case 'reference':
    case 'containment':
      return `${field.type} → ${schemaName(field.symSchemaId, template)}`;
    case 'typedRelation':
      return `relation (${field.direction})`;
    case 'derived':
      return `derived (${field.resultType})`;
    default:
      return field.type;
  }
};

const schemaPage = (template: SchemaTemplate, schema: TemplateSchema): string => {
  const lines: string[] = [`# ${schema.name}`, '', schema.description, ''];
  lines.push(`Part of the [${template.name}](./overview) data model.`, '');

  const groups = schema.groups ?? [];
  const sections: Array<{ title: string; description?: string; fields: SymbolicField[] }> = [];
  for (const group of groups) {
    const fields = schema.fields.filter(f => f.groupId === group.id);
    if (fields.length > 0) {
      sections.push({ title: group.name, description: group.description, fields });
    }
  }
  const ungrouped = schema.fields.filter(f => !f.groupId || !groups.some(g => g.id === f.groupId));
  if (ungrouped.length > 0) {
    sections.unshift({ title: sections.length > 0 ? 'General' : 'Fields', fields: ungrouped });
  }

  if (sections.length > 0) {
    lines.push('## Fields', '');
    for (const section of sections) {
      if (sections.length > 1 || section.title !== 'Fields') lines.push(`### ${section.title}`, '');
      if (section.description) lines.push(section.description, '');
      lines.push('| Field | Type | Description |', '| --- | --- | --- |');
      for (const field of section.fields) {
        lines.push(
          `| ${cell(field.name)} | ${cell(fieldTypeLabel(field, template))} | ${cell(field.description)} |`
        );
      }
      lines.push('');
    }
  }

  lines.push(...relationshipsSection(template, schema));

  return lines.join('\n').trimEnd() + '\n';
};

const overviewPage = (template: SchemaTemplate): string => {
  const lines: string[] = [`# ${template.name}`, '', template.description, ''];
  lines.push(
    template.category === 'full'
      ? 'This is a full data model: it provides a complete starting model for a workspace.'
      : 'This is a cross-cutting data model: it adds a concern on top of a full data model.',
    ''
  );

  if (template.schemas.length > 0) {
    lines.push('## Schemas', '');
    for (const schema of template.schemas) {
      lines.push(`- [${schema.name}](./${schema.symId}) — ${schema.description}`);
    }
    lines.push('');
  }

  const structure = template.schemas.flatMap(schema =>
    structuralFields(schema).map(field => structuralStatement(template, schema, field))
  );
  const relations = (template.relationSchemas ?? []).map(relation =>
    relationSummary(template, relation)
  );
  if (structure.length > 0 || relations.length > 0) {
    lines.push('## How the schemas relate', '');
    if (structure.length > 0) {
      lines.push('### Structure', '', ...structure.map(item => `- ${item}`), '');
    }
    if (relations.length > 0) {
      lines.push('### Relations', '', ...relations.map(item => `- ${item}`), '');
    }
  }

  if ((template.relationSchemas ?? []).length > 0) {
    lines.push('## Relation types', '');
    for (const relation of template.relationSchemas ?? []) {
      lines.push(`- **${relation.name}** — ${relation.description}`);
    }
    lines.push('');
  }

  if ((template.dependencies ?? []).length > 0) {
    lines.push('## Dependencies', '');
    lines.push(
      'When this data model is applied, the following must be mapped to existing definitions:',
      ''
    );
    for (const dependency of template.dependencies ?? []) {
      lines.push(`- **${dependency.name}** — ${dependency.description}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd() + '\n';
};

const indexPage = (templates: readonly SchemaTemplate[]): string => {
  const lines: string[] = [
    '# Data Model',
    '',
    'The data model of this workspace. Each page describes the purpose of a part of the model, the schemas it provides and how their entities relate to each other.',
    ''
  ];
  for (const template of templates) {
    lines.push(`- [${template.name}](./${template.id}/overview) — ${template.description}`);
  }
  return lines.join('\n') + '\n';
};

/**
 * Builds the data model documentation pages shipped with the given template bundles: an index page, and
 * per bundle an overview page plus one page per schema.
 *
 * The pages are generated from the template definitions, so they cannot drift from the schemas
 * they describe.
 */
export const buildTemplateWikiPages = (options: TemplateWikiOptions): TemplateWikiNode[] => {
  const { workspaceId } = options;
  const templates = options.templateIds
    .map(id => SCHEMA_TEMPLATES.find(template => template.id === id))
    .filter((template): template is SchemaTemplate => template !== undefined)
    .filter((template, index, all) => all.indexOf(template) === index);
  if (templates.length === 0) return [];

  const nodes: TemplateWikiNode[] = [];
  const folderId = stableId(workspaceId, DATA_MODEL_FOLDER_PATH);
  nodes.push({
    id: folderId,
    parentId: null,
    path: DATA_MODEL_FOLDER_PATH,
    name: 'Data Model',
    type: 'folder'
  });
  nodes.push({
    id: stableId(workspaceId, `${DATA_MODEL_FOLDER_PATH}/index`),
    parentId: folderId,
    path: `${DATA_MODEL_FOLDER_PATH}/index`,
    name: 'Data Model',
    type: 'markdown',
    body: indexPage(templates)
  });

  for (const template of templates) {
    const templatePath = `${DATA_MODEL_FOLDER_PATH}/${template.id}`;
    const templateFolderId = stableId(workspaceId, templatePath);
    nodes.push({
      id: templateFolderId,
      parentId: folderId,
      path: templatePath,
      name: template.name,
      type: 'folder'
    });
    nodes.push({
      id: stableId(workspaceId, `${templatePath}/overview`),
      parentId: templateFolderId,
      path: `${templatePath}/overview`,
      name: `${template.name} overview`,
      type: 'markdown',
      body: overviewPage(template)
    });
    for (const schema of template.schemas) {
      const path = `${templatePath}/${schema.symId}`;
      nodes.push({
        id: stableId(workspaceId, path),
        parentId: templateFolderId,
        path,
        name: schema.name,
        type: 'markdown',
        body: schemaPage(template, schema)
      });
    }
  }
  return nodes;
};
