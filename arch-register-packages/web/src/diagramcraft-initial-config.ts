import { createDiagramCraft } from '@diagram-craft/main/embed/createDiagramCraft';

let _currentWorkspaceId: string | undefined;

export const initializeDiagramCraft = (workspaceId: string) => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const instance = createDiagramCraft({
    collaboration: { backend: 'yjs', url: wsUrl }
  });

  if (workspaceId !== _currentWorkspaceId) {
    instance.updateConfig({ ai: { provider: 'remote', endpoint: `/api/${workspaceId}` } });
    _currentWorkspaceId = workspaceId;
  }

  return instance;
};
