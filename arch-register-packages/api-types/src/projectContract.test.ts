import { describe, expect, it } from 'vitest';
import { projectContract } from './projectContract';
import { projectDocumentDiscoveryContract } from './projectDocumentDiscoveryContract';

const expectedProjectOperations = [
  'list',
  'get',
  'create',
  'update',
  'remove',
  'listFiles',
  'createFolder',
  'renameFolder',
  'deleteFolder',
  'getFileContent',
  'saveFile',
  'deleteFile',
  'cloneFile',
  'relocateFile',
  'updateTemplateStatus',
  'listEntities',
  'listEntityProjects',
  'addEntity',
  'updateEntity',
  'removeEntity',
  'getEntityDiagramFiles',
  'listEntityFiles',
  'createEntityFolder',
  'createEntityFile',
  'listWorkspaceFiles',
  'deleteEntityFile',
  'deleteEntityFolder',
  'renameEntityFolder',
  'cloneEntityFile',
  'relocateEntityFile',
  'deleteWorkspaceFile',
  'deleteWorkspaceFolder',
  'renameWorkspaceFolder',
  'cloneWorkspaceFile',
  'relocateWorkspaceFile',
  'createWorkspaceFolder',
  'createWorkspaceFile',
  'getWorkspaceFileContent',
  'saveWorkspaceFile',
  'createProjectMarkdown',
  'createEntityMarkdown',
  'createWorkspaceMarkdown',
  'getFile',
  'getDiagramContent',
  'getMarkdownContent',
  'saveMarkdownContent',
  'migrateMarkdownContent',
  'saveNewMarkdownContent',
  'listMarkdownRevisions',
  'listMarkdownWorkflowHistory',
  'overrideMarkdownWorkflow',
  'getMarkdownRevision',
  'restoreMarkdownRevision',
  'createMarkdownDiagramAttachment',
  'listRelatedContent',
  'listDocumentBacklinks',
  'runDocumentAiAction',
  'testDocumentAiAction',
  'listDocuments'
];

describe('document AI action test contract', () => {
  it('accepts a draft disabled metadata generator action', () => {
    const inputSchema = projectContract.projects.testDocumentAiAction['~orpc'].inputSchema;
    if (!inputSchema) throw new Error('Test action input schema is not defined');

    const parsed = inputSchema.parse({
      params: { workspace: 'workspace-1', nodeId: 'node-1' },
      body: {
        documentTypeId: 'type-1',
        action: {
          id: 'generator-1',
          name: 'Generate status',
          kind: 'metadata_generator',
          prompt: 'Choose the current status.',
          outputFieldId: 'status',
          enabled: false
        }
      }
    });

    expect(parsed.body.action.enabled).toBe(false);
    expect(parsed.body.action.kind).toBe('metadata_generator');
  });
});

describe('project contract composition', () => {
  it('keeps every focused project operation in the public router', () => {
    expect(Object.keys(projectContract.projects)).toEqual(expectedProjectOperations);
    expect(Object.keys(projectContract.projects)).toHaveLength(59);
  });

  it('retains the complete document discovery fragment', () => {
    expect(Object.keys(projectDocumentDiscoveryContract)).toEqual([
      'listRelatedContent',
      'listDocumentBacklinks',
      'listDocuments'
    ]);
  });
});
