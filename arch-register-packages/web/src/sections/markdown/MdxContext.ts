import { createContext, useContext } from 'react';

interface MdxContextValue {
  workspaceSlug?: string;
  projectId?: string;
  entityId?: string;
  nodeId?: string;
}

export const MdxContext = createContext<MdxContextValue>({});

export const useMdxContext = () => useContext(MdxContext);
