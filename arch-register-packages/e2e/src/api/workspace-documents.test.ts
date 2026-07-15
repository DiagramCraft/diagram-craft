import { expect, test } from '../helpers/fixtures';

const suggestedResolutions = (parseResult: {
  conflicts: Array<{
    item_id: string;
    suggested_resolution: 'skip' | 'merge' | 'overwrite' | 'rename';
  }>;
}) =>
  Object.fromEntries(
    parseResult.conflicts.map(conflict => [
      conflict.item_id,
      { action: conflict.suggested_resolution }
    ])
  );

test('workspace copy preserves typed documents, links, templates, and entity content', async ({
  orpc
}) => {
  const suffix = Date.now().toString();
  const source = await orpc.workspaces.create({
    body: { name: `Typed source workspace ${suffix}`, badge: 'TS' }
  });
  const sourceWorkspace = source.id;
  const schema = await orpc.schemas.create({
    params: { workspace: source.url_slug },
    body: { name: `Copy source schema ${suffix}`, key_prefix: 'CPS' }
  });
  const entity = await orpc.entities.create({
    params: { workspace: source.url_slug },
    body: {
      _schemaId: schema.id,
      _name: `Copy source entity ${suffix}`,
      _namespace: 'default'
    } as never
  });
  const documentType = await orpc.documents.documentTypes.create({
    params: { workspace: source.url_slug },
    body: {
      name: `Copy document type ${suffix}`,
      description: '',
      fields: [
        {
          id: 'affected_entity',
          name: 'Affected entity',
          type: 'entity_link',
          requirement: 'optional',
          maxCardinality: 1,
          retired: false
        },
        {
          id: 'related_document',
          name: 'Related document',
          type: 'document_link',
          requirement: 'optional',
          maxCardinality: 1,
          retired: false
        }
      ]
    }
  });
  const sourceProject = await orpc.projects.create({
    params: { workspace: source.url_slug },
    body: { name: `Copy source project ${suffix}` }
  });

  const workspaceDocument = await orpc.projects.createWorkspaceMarkdown({
    params: { workspace: source.url_slug },
    body: { name: `Workspace copy document ${suffix}` }
  });
  await orpc.projects.migrateMarkdownContent({
    params: { workspace: source.url_slug, nodeId: workspaceDocument.id },
    body: {
      body: '# Workspace copy',
      document_type_id: documentType.id,
      metadata: { affected_entity: entity._uid }
    }
  });

  const projectDocument = await orpc.projects.createProjectMarkdown({
    params: { workspace: source.url_slug, id: sourceProject.public_id },
    body: { name: `Project copy document ${suffix}` }
  });
  const entityDocument = await orpc.projects.createEntityMarkdown({
    params: { workspace: source.url_slug, entityId: entity._publicId },
    body: { name: `Entity copy document ${suffix}` }
  });
  await orpc.projects.migrateMarkdownContent({
    params: { workspace: source.url_slug, nodeId: entityDocument.id },
    body: {
      body: '# Entity copy',
      document_type_id: documentType.id,
      metadata: { affected_entity: entity._uid }
    }
  });
  await orpc.projects.migrateMarkdownContent({
    params: { workspace: source.url_slug, nodeId: projectDocument.id },
    body: {
      body: '# Project copy',
      document_type_id: documentType.id,
      metadata: { affected_entity: entity._uid, related_document: entityDocument.id }
    }
  });

  const template = await orpc.documents.documentTemplates.create({
    params: { workspace: source.url_slug },
    body: {
      name: `Copy template ${suffix}`,
      body: '# {{title}}',
      document_type_id: documentType.id,
      metadata_defaults: { affected_entity: entity._uid },
      project_id: null
    }
  });
  const projectTemplate = await orpc.documents.documentTemplates.create({
    params: { workspace: source.url_slug },
    body: {
      name: `Project template ${suffix}`,
      body: '# {{title}}',
      document_type_id: documentType.id,
      metadata_defaults: { affected_entity: entity._uid },
      project_id: sourceProject.id
    }
  });

  const copiedWorkspace = await orpc.workspaces.create({
    body: {
      name: `Copied typed workspace ${suffix}`,
      badge: 'CD',
      replicate_from: sourceWorkspace,
      include: ['schemas', 'entities', 'projects', 'documents', 'settings']
    }
  });

  const copiedTypes = await orpc.documents.documentTypes.list({
    params: { workspace: copiedWorkspace.url_slug },
    query: { include_archived: false }
  });
  const copiedType = copiedTypes.find(type => type.name === documentType.name);
  expect(copiedType).toEqual(expect.objectContaining({ name: documentType.name }));
  expect(copiedType?.id).not.toBe(documentType.id);

  const copiedTemplates = await orpc.documents.documentTemplates.list({
    params: { workspace: copiedWorkspace.url_slug },
    query: { include_archived: false }
  });
  expect(copiedTemplates).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: template.name,
        document_type_id: copiedType?.id,
        metadata_defaults: { affected_entity: expect.any(String) }
      })
    ])
  );
  const copiedProjects = await orpc.projects.list({
    params: { workspace: copiedWorkspace.url_slug }
  });
  const copiedProject = copiedProjects.find(projectItem => projectItem.name === sourceProject.name);
  expect(copiedProject).toEqual(expect.objectContaining({ name: sourceProject.name }));
  const copiedProjectTemplates = await orpc.documents.documentTemplates.list({
    params: { workspace: copiedWorkspace.url_slug },
    query: { project_id: copiedProject!.id, include_archived: false }
  });
  expect(copiedProjectTemplates).toEqual(
    expect.arrayContaining([expect.objectContaining({ name: projectTemplate.name, project_id: copiedProject!.id })])
  );

  const copiedEntities = await orpc.entities.list({
    params: { workspace: copiedWorkspace.url_slug },
    query: {}
  });
  const copiedEntity = copiedEntities.find(entityItem => entityItem._name === entity._name);
  expect(copiedEntity).toEqual(expect.objectContaining({ _name: entity._name }));
  expect(copiedEntity?._uid).not.toBe(entity._uid);

  const copiedEntityFiles = await orpc.projects.listEntityFiles({
    params: { workspace: copiedWorkspace.url_slug, entityId: copiedEntity!._publicId }
  });
  expect(copiedEntityFiles).toEqual(
    expect.objectContaining({
      rootFiles: expect.arrayContaining([
        expect.objectContaining({ name: entityDocument.name, type: 'markdown' })
      ])
    })
  );
  const copiedProjectFiles = await orpc.projects.listFiles({
    params: { workspace: copiedWorkspace.url_slug, id: copiedProject!.id }
  });
  const copiedProjectDocument = copiedProjectFiles.rootFiles.find(
    file => file.name === projectDocument.name
  );
  expect(copiedProjectDocument).toBeDefined();
  const copiedProjectContent = await orpc.projects.getMarkdownContent({
    params: { workspace: copiedWorkspace.url_slug, nodeId: copiedProjectDocument!.id }
  });
  expect(copiedProjectContent.metadata).toMatchObject({
    affected_entity: copiedEntity!._uid,
    related_document: expect.any(String)
  });
  expect(copiedProjectContent.metadata.related_document).not.toBe(entityDocument.id);

  const related = await orpc.projects.listRelatedContent({
    params: { workspace: copiedWorkspace.url_slug, entityId: copiedEntity!._publicId }
  });
  expect(related).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        document_type_id: copiedType?.id,
        document_type_name: copiedType?.name,
        field_id: 'affected_entity'
      })
    ])
  );

  const exportResponse = await orpc.workspaces.export({
    params: { workspace: source.url_slug },
    body: {
      include: ['config', 'schemas', 'entities', 'projects', 'content_nodes', 'documents'],
      options: { include_content: true }
    }
  });
  const importTarget = await orpc.workspaces.create({
    body: { name: `Imported typed workspace ${suffix}`, badge: 'IT' }
  });
  const parseResult = await orpc.workspaces.importParse({
    params: { workspace: importTarget.url_slug },
    body: { file: new File([exportResponse.body as Blob], 'typed-documents.zip') }
  });
  expect(parseResult.valid).toBe(true);
  const executeResult = await orpc.workspaces.importExecute({
    params: { workspace: importTarget.url_slug },
    body: {
      import_id: parseResult.import_id!,
      include: ['config', 'schemas', 'entities', 'projects', 'content_nodes', 'documents'],
      conflict_resolutions: suggestedResolutions(parseResult),
      options: { preserve_ids: false, update_references: true }
    }
  });
  expect(executeResult).toMatchObject({
    success: true,
    imported: {
      documents: expect.objectContaining({ created: 1, metadata: 3, revisions: 3 })
    },
    errors: []
  });

  const importedTypes = await orpc.documents.documentTypes.list({
    params: { workspace: importTarget.url_slug },
    query: { include_archived: false }
  });
  expect(importedTypes).toEqual(expect.arrayContaining([expect.objectContaining({ name: documentType.name })]));
  const importedWorkspaceFiles = await orpc.projects.listWorkspaceFiles({
    params: { workspace: importTarget.url_slug }
  });
  const importedWorkspaceDocument = importedWorkspaceFiles.rootFiles.find(
    file => file.name === workspaceDocument.name
  );
  expect(importedWorkspaceDocument).toBeDefined();
  const importedContent = await orpc.projects.getMarkdownContent({
    params: { workspace: importTarget.url_slug, nodeId: importedWorkspaceDocument!.id }
  });
  expect(importedContent.body).toContain('# Workspace copy');
});
