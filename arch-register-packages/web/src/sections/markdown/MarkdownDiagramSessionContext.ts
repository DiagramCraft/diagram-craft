import { createContext, useContext } from 'react';

type DiagramRecord = { id: string; path: string; name?: string };

type MarkdownDiagramSessionContextValue = {
  sessionId?: string;
  trackCreatedDiagram: (record: DiagramRecord) => void;
};

export const MarkdownDiagramSessionContext = createContext<MarkdownDiagramSessionContextValue>({
  sessionId: undefined,
  trackCreatedDiagram: () => {}
});

export const useMarkdownDiagramSession = () => useContext(MarkdownDiagramSessionContext);
