import { createContext, useContext } from 'react';

interface MdxContextValue {
  projectId?: string;
}

export const MdxContext = createContext<MdxContextValue>({});

export const useMdxContext = () => useContext(MdxContext);
