import { ObjectPickerPanel } from './ObjectPickerPanel';
import { useDiagram } from '../../../application';

export const RecentShapesPickerPanel = () => {
  const diagram = useDiagram();
  const stencilRegistry = diagram.document.registry.stencils;

  return (
    <ObjectPickerPanel
      stencils={diagram.document.props.recentStencils.stencils.map(
        s => stencilRegistry.getStencil(s)!
      )}
      id={'recent-shapes'}
      title={'Recent shapes'}
      isOpen={true}
      mode={'headless'}
    />
  );
};
