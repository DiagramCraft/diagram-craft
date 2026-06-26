// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildMarkdownCloseImpactSummary,
  clearMarkdownDiagramSession,
  getMarkdownDiagramRollbackRecords,
  hashDiagramContent,
  rememberMarkdownDiagramOriginal,
  updateMarkdownDiagramSessionRecord
} from './markdownDiagramSession';

describe('markdownDiagramSession', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it('stores the original snapshot only once per session and diagram', () => {
    rememberMarkdownDiagramOriginal('session-1', {
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Diagram 1',
      originalContent: '{"a":1}'
    });
    rememberMarkdownDiagramOriginal('session-1', {
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Diagram 1 updated',
      originalContent: '{"a":2}'
    });

    expect(getMarkdownDiagramRollbackRecords('session-1')).toEqual([
      {
        diagramId: 'diagram-1',
        path: 'a/diagram.json',
        name: 'Diagram 1',
        originalContent: '{"a":1}',
        originalContentHash: hashDiagramContent('{"a":1}'),
        sawCollaborators: false
      }
    ]);
  });

  it('updates saved hashes without overwriting the original snapshot', () => {
    rememberMarkdownDiagramOriginal('session-1', {
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Diagram 1',
      originalContent: '{"a":1}'
    });

    updateMarkdownDiagramSessionRecord('session-1', 'diagram-1', {
      lastSavedContentHash: 'saved-hash',
      name: 'Renamed'
    });

    expect(getMarkdownDiagramRollbackRecords('session-1')[0]).toEqual({
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Renamed',
      originalContent: '{"a":1}',
      originalContentHash: hashDiagramContent('{"a":1}'),
      lastSavedContentHash: 'saved-hash',
      sawCollaborators: false
    });
  });

  it('keeps collaborator state once detected', () => {
    rememberMarkdownDiagramOriginal('session-1', {
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Diagram 1',
      originalContent: '{"a":1}'
    });

    updateMarkdownDiagramSessionRecord('session-1', 'diagram-1', { sawCollaborators: true });
    updateMarkdownDiagramSessionRecord('session-1', 'diagram-1', { sawCollaborators: false });

    expect(getMarkdownDiagramRollbackRecords('session-1')[0]?.sawCollaborators).toBe(true);
  });

  it('clears only the requested session', () => {
    rememberMarkdownDiagramOriginal('session-1', {
      diagramId: 'diagram-1',
      path: 'a/diagram.json',
      name: 'Diagram 1',
      originalContent: '{"a":1}'
    });
    rememberMarkdownDiagramOriginal('session-2', {
      diagramId: 'diagram-2',
      path: 'b/diagram.json',
      name: 'Diagram 2',
      originalContent: '{"a":2}'
    });

    clearMarkdownDiagramSession('session-1');

    expect(getMarkdownDiagramRollbackRecords('session-1')).toEqual([]);
    expect(getMarkdownDiagramRollbackRecords('session-2')).toHaveLength(1);
  });

  it('builds the close impact summary', () => {
    const summary = buildMarkdownCloseImpactSummary({
      createdDiagrams: [
        { id: 'created-delete', path: 'attachments/created-delete.json', name: 'Created delete' },
        { id: 'created-keep', path: 'attachments/created-keep.json', name: 'Created keep' }
      ],
      savedBody: 'Saved body mentions created-keep',
      records: [
        {
          diagramId: 'revertable',
          path: 'attachments/revertable.json',
          name: 'Revertable',
          originalContent: '{}',
          originalContentHash: 'orig',
          lastSavedContentHash: 'same',
          sawCollaborators: false
        },
        {
          diagramId: 'collaborative',
          path: 'attachments/collaborative.json',
          name: 'Collaborative',
          originalContent: '{}',
          originalContentHash: 'orig',
          lastSavedContentHash: 'same',
          sawCollaborators: true
        },
        {
          diagramId: 'changed',
          path: 'attachments/changed.json',
          name: 'Changed',
          originalContent: '{}',
          originalContentHash: 'orig',
          lastSavedContentHash: 'old',
          sawCollaborators: false
        },
        {
          diagramId: 'created-delete',
          path: 'attachments/created-delete.json',
          name: 'Created delete',
          originalContent: '{}',
          originalContentHash: 'orig',
          lastSavedContentHash: 'same',
          sawCollaborators: false
        }
      ],
      currentContentHashes: {
        revertable: 'same',
        collaborative: 'same',
        changed: 'new',
        'created-delete': 'same'
      }
    });

    expect(summary).toEqual({
      createdDiagramsToDelete: [
        { id: 'created-delete', path: 'attachments/created-delete.json', name: 'Created delete' }
      ],
      revertableDiagrams: [
        { diagramId: 'revertable', path: 'attachments/revertable.json', name: 'Revertable' }
      ],
      nonRevertableDiagrams: [
        {
          diagramId: 'collaborative',
          path: 'attachments/collaborative.json',
          name: 'Collaborative',
          reason: 'collaborative'
        },
        {
          diagramId: 'changed',
          path: 'attachments/changed.json',
          name: 'Changed',
          reason: 'changed'
        }
      ]
    });
  });
});
