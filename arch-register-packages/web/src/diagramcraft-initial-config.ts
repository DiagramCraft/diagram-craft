import { bootstrapDiagramCraft } from '@diagram-craft/main/embed/bootstrapDiagramCraft';
import { isDemoMode } from './lib/demoMode';

let _currentWorkspaceId: string | undefined;

export const initializeDiagramCraft = (workspaceId: string) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const instance = bootstrapDiagramCraft({
    // The demo has no collaboration server; documents are saved explicitly
    collaboration: isDemoMode ? { backend: 'noop' } : { backend: 'yjs', url: wsUrl }
  });

  // AI is disabled in the demo
  if (!isDemoMode && workspaceId !== _currentWorkspaceId) {
    instance.updateConfig({
      ai: { provider: 'remote', endpoint: `/api/adapters/diagram-craft/${workspaceId}` }
    });
    _currentWorkspaceId = workspaceId;
  }

  return instance;
};
