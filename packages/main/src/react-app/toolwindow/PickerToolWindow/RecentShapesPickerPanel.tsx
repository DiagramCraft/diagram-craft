import { ObjectPickerPanel } from './ObjectPickerPanel';
import { useDiagram } from '../../../application';
import { UserState } from '../../../UserState';

export const RecentShapesPickerPanel = () => {
  const diagram = useDiagram();
  const stencilRegistry = diagram.document.registry.stencils;
  const userState = UserState.get();

  const recent = diagram.document.props.recentStencils;
  return (
    <ObjectPickerPanel
      stencils={recent.stencils.map(s => stencilRegistry.getStencil(s)!).filter(e => !!e)}
      id={'recent-shapes'}
      title={'Recent shapes'}
      isOpen={true}
      mode={'headless'}
      pickerViewMode={userState.stencilPickerViewMode}
    />
  );
};
