import { DiagramEdge } from './diagramEdge.ts';
import { DiagramNode } from './diagramNode.ts';

export type DiagramElement = DiagramNode | DiagramEdge;

export const getDiagramElementPath = (element: DiagramElement): DiagramNode[] => {
  const dest: DiagramNode[] = [];
  let current: DiagramNode | undefined = element.parent;
  while (current !== undefined) {
    dest.push(current);
    current = current.parent;
  }
  return dest;
};

export const getTopMostNode = (element: DiagramNode): DiagramNode => {
  const path = getDiagramElementPath(element);
  return path.length > 0 ? path[path.length - 1] : element;
};

export const isNode = (e: DiagramElement): e is DiagramNode => e.type === 'node';
export const isEdge = (e: DiagramElement): e is DiagramEdge => e.type === 'edge';
