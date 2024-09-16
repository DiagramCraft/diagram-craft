import { useEffect } from 'react';
import { useRedraw } from '../../hooks/useRedraw';
import { LayerList } from './LayerList';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { useDiagram } from '../../../application';

export const LayerToolWindow = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();

  useEffect(() => {
    const onChange = () => {
      redraw();
    };
    diagram.on('change', onChange);
    diagram.on('elementRemove', onChange);
    diagram.on('elementAdd', onChange);
    return () => {
      diagram.off('change', onChange);
      diagram.off('elementRemove', onChange);
      diagram.off('elementAdd', onChange);
    };
  }, [diagram, redraw]);

  return (
    <Accordion.Root disabled={true} type="single" defaultValue={'layers'}>
      <Accordion.Item value="layers">
        <Accordion.ItemHeader>Layers</Accordion.ItemHeader>
        <Accordion.ItemContent>
          <LayerList />
        </Accordion.ItemContent>
      </Accordion.Item>
    </Accordion.Root>
  );
};
