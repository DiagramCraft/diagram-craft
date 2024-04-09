import { DiagramElement } from '@diagram-craft/model';
import { UnitOfWork } from '@diagram-craft/model';

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
  if (!element.props.highlight) return;

  UnitOfWork.execute(element.diagram, uow => {
    element.updateProps(props => {
      props.highlight = props.highlight!.filter(h => h !== highlight);
    }, uow);
  });
};
