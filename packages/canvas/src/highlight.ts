import { DiagramElement } from '@diagram-craft/model/diagramElement';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';

export const addHighlight = (element: DiagramElement, highlight: string) => {
  UnitOfWork.execute(element.diagram, uow => {
    element.updateProps(props => {
      props.highlight ??= [];
      props.highlight.push(highlight);
    }, uow);
  });
};

export const removeHighlight = (element: DiagramElement | undefined, highlight: string) => {
  if (!element) return;
  if (!element.renderProps.highlight) return;

  UnitOfWork.execute(element.diagram, uow => {
    element.updateProps(props => {
      props.highlight = (props.highlight ?? []).filter(h => h !== highlight);
    }, uow);
  });
};

export const hasHighlight = (element: DiagramElement, highlight: string) => {
  return element.renderProps.highlight?.includes(highlight) ?? false;
};

export const clearHighlights = (element: DiagramElement) => {
  UnitOfWork.execute(element.diagram, uow => {
    element.updateProps(props => {
      props.highlight = [];
    }, uow);
  });
};

export const getHighlights = (element: DiagramElement | undefined) => {
  if (!element) return [];
  return element.renderProps.highlight ?? [];
};
