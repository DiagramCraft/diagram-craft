import { createContext, useContext } from 'react';

type DiagramRecord = { id: string; path: string };

type MarkdownDiagramSessionContextValue = {
  trackCreatedDiagram: (record: DiagramRecord) => void;
};

export const MarkdownDiagramSessionContext = createContext<MarkdownDiagramSessionContextValue>({
  trackCreatedDiagram: () => {}
});

export const useMarkdownDiagramSession = () => useContext(MarkdownDiagramSessionContext);
