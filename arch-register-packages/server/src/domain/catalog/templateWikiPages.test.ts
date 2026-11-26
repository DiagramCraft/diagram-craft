import { describe, expect, test } from 'vitest';
import { SCHEMA_TEMPLATES } from './schemaTemplates';
import { buildTemplateWikiPages } from './templateWikiPages';

const WS = 'ws-1';

describe('buildTemplateWikiPages', () => {
  test('every template gets an overview page and one page per schema', () => {
    for (const template of SCHEMA_TEMPLATES) {
      const nodes = buildTemplateWikiPages({ workspaceId: WS, templateIds: [template.id] });
      const prefix = `data-model/${template.id}/`;
      const paths = nodes.filter(n => n.type === 'markdown').map(n => n.path);

      expect(paths, template.id).toContain(`${prefix}overview`);
      for (const schema of template.schemas) {
        expect(paths, `${template.id}/${schema.symId}`).toContain(`${prefix}${schema.symId}`);
      }
      for (const node of nodes.filter(n => n.type === 'markdown')) {
        expect(node.body?.trim().length, node.path).toBeGreaterThan(0);
      }
    }
  });

  test('has unique ids and paths, and every parent exists, when combining all templates', () => {
    const nodes = buildTemplateWikiPages({
      workspaceId: WS,
      templateIds: SCHEMA_TEMPLATES.map(t => t.id)
    });
    const ids = new Set(nodes.map(n => n.id));
    expect(ids.size).toBe(nodes.length);
    expect(new Set(nodes.map(n => n.path)).size).toBe(nodes.length);
    for (const node of nodes) {
      if (node.parentId !== null) expect(ids.has(node.parentId), node.path).toBe(true);
    }
  });

  test('is deterministic and scoped to the workspace', () => {
    const a = buildTemplateWikiPages({ workspaceId: WS, templateIds: ['default'] });
    const b = buildTemplateWikiPages({ workspaceId: WS, templateIds: ['default'] });
    const c = buildTemplateWikiPages({ workspaceId: 'ws-2', templateIds: ['default'] });
    expect(a).toEqual(b);
    expect(a[0]!.id).not.toBe(c[0]!.id);
  });

  test('places everything in a top-level data-model folder', () => {
    const nodes = buildTemplateWikiPages({ workspaceId: WS, templateIds: ['default'] });
    expect(nodes[0]).toMatchObject({ path: 'data-model', parentId: null, type: 'folder' });
    for (const node of nodes) expect(node.path.startsWith('data-model')).toBe(true);
    expect(nodes.find(n => n.path === 'data-model/index')?.body).toContain('# Data Model');
  });

  test('ignores unknown template ids', () => {
    expect(buildTemplateWikiPages({ workspaceId: WS, templateIds: ['blank'] })).toEqual([]);
  });

  test('describes schema fields in the schema page', () => {
    const template = SCHEMA_TEMPLATES.find(t => t.id === 'default')!;
    const schema = template.schemas.find(s => s.fields.length > 0)!;
    const page = buildTemplateWikiPages({ workspaceId: WS, templateIds: ['default'] }).find(
      n => n.path === `data-model/default/${schema.symId}`
    )!;
    expect(page.body).toContain(`# ${schema.name}`);
    expect(page.body).toContain(schema.fields[0]!.name);
  });

  const pageBody = (templateId: string, symId: string) =>
    buildTemplateWikiPages({ workspaceId: WS, templateIds: [templateId] }).find(
      n => n.path === `data-model/${templateId}/${symId}`
    )!.body!;

  test('describes how entities are structurally related', () => {
    const component = pageBody('default', 'component');
    expect(component).toContain('## Relationships');
    expect(component).toContain('A **Component** *belongs to* exactly one **System**');
    expect(component).toContain('*depends on*');

    const system = pageBody('default', 'system');
    expect(system).toContain('A **System** is composed of **Component** entities');
    expect(pageBody('default', 'contract')).toContain(
      'A **Contract** *is provided by* exactly one **Vendor**'
    );
    expect(pageBody('default', 'api')).toContain('An **API** *belongs to* exactly one **System**');
    expect(system).toContain('A **System** *belongs to* exactly one **Domain**');
  });

  test('describes typed relations from both ends', () => {
    expect(pageBody('default', 'system')).toContain('*Uses Contract* → **Contract**');
    expect(pageBody('default', 'contract')).toContain('*Used by System* ← **System**');
  });

  test('summarises relationships on the overview page', () => {
    const overview = buildTemplateWikiPages({ workspaceId: WS, templateIds: ['default'] }).find(
      n => n.path === 'data-model/default/overview'
    )!.body!;
    expect(overview).toContain('## How the schemas relate');
    expect(overview).toContain('A **Component** *belongs to* exactly one **System**');
    expect(overview).toContain('→ *Provides APIs* →');
  });
});
