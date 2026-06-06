import { describe, expect, it } from 'vitest';
import { deriveActiveView } from './deriveActiveView.js';

const match = (routeId: string) => [{ routeId }];

describe('deriveActiveView', () => {
  it('returns "diagram" for diagram routes', () => {
    expect(deriveActiveView(match('/workspace/ws-1/diagrams/d-1'))).toBe('diagram');
  });

  it('returns "entity-detail" for entity detail routes', () => {
    expect(deriveActiveView(match('/workspace/ws-1/entities/$entityId'))).toBe('entity-detail');
  });

  it('returns "entity-browser" for entity import routes', () => {
    expect(deriveActiveView(match('/workspace/ws-1/entities/import'))).toBe('entity-browser');
  });

  it('returns "entity-browser" for the entities root route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/entities'))).toBe('entity-browser');
  });

  it('returns "project-detail" for project sub-routes', () => {
    expect(deriveActiveView(match('/workspace/ws-1/projects/p-1/files'))).toBe('project-detail');
  });

  it('returns "data-model" for the model route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/model'))).toBe('data-model');
  });

  it('returns "search" for the search route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/search'))).toBe('search');
  });

  it('returns "assistant" for the assistant route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/assistant'))).toBe('assistant');
  });

  it('returns "extract" for the extract route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/extract'))).toBe('extract');
  });

  it('returns "global-settings" for global settings routes', () => {
    expect(deriveActiveView(match('/workspace/ws-1/settings/global/users'))).toBe('global-settings');
  });

  it('returns "workspace-settings" for the settings route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/settings'))).toBe('workspace-settings');
  });

  it('returns "account-settings" for the account route', () => {
    expect(deriveActiveView(match('/workspace/ws-1/account'))).toBe('account-settings');
  });

  it('returns "home" when no route matches', () => {
    expect(deriveActiveView(match('/workspace/ws-1'))).toBe('home');
  });

  it('returns "home" for empty matches', () => {
    expect(deriveActiveView([])).toBe('home');
  });

  it('diagram takes priority over entity-detail when both match', () => {
    expect(deriveActiveView([
      { routeId: '/workspace/ws-1/entities/$entityId' },
      { routeId: '/workspace/ws-1/diagrams/d-1' },
    ])).toBe('diagram');
  });
});
