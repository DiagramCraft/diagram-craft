import { createContext, useContext, useState, ReactNode } from 'react';

type QueryToolWindowContextType = {
  djqlQuery: string;
  djqlScope: string;
  setDjqlQuery: (query: string, scope: string) => void;
};

const QueryToolWindowContext = createContext<QueryToolWindowContextType | null>(null);

export const useQueryToolWindowContext = (): QueryToolWindowContextType => {
  const context = useContext(QueryToolWindowContext);
  if (!context) {
    throw new Error('useQueryToolWindowContext must be used within a QueryToolWindowProvider');
  }
  return context;
};

type QueryToolWindowProviderProps = {
  children: ReactNode;
};

export const QueryToolWindowProvider = ({ children }: QueryToolWindowProviderProps) => {
  const [djqlQuery, setDjqlQueryState] = useState<string>('.elements[]');
  const [djqlScope, setDjqlScopeState] = useState<string>('active-layer');

  const setDjqlQuery = (query: string, scope: string) => {
    setDjqlQueryState(query);
    setDjqlScopeState(scope);
  };

  const contextValue: QueryToolWindowContextType = {
    djqlQuery,
    djqlScope,
    setDjqlQuery
  };

  return (
    <QueryToolWindowContext.Provider value={contextValue}>
      {children}
    </QueryToolWindowContext.Provider>
  );
};