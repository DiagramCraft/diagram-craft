import { createContext, useContext } from 'react';

interface MdxContextValue {
  workspaceSlug?: string;
  projectId?: string;
  entityId?: string;
  nodeId?: string;
  renderMode?: 'dashboard' | 'wiki';
}

export const MdxContext = createContext<MdxContextValue>({});

export const useMdxContext = () => useContext(MdxContext);
