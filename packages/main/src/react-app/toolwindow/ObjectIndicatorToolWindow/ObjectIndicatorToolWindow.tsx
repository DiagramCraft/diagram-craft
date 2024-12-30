import { useCallback, useEffect, useState } from 'react';
import { useDiagram } from '../../../application';
import { Accordion } from '@diagram-craft/app-components/Accordion';
import { DefaultIndicatorPanel } from './DefaultIndicatorPanel';
import { NamedIndicatorPanel } from './NamedIndicatorPanel';

export const ObjectIndicatorToolWindow = () => {
  const diagram = useDiagram();

  const [visible, setVisible] = useState<boolean>(false);

  const callback = useCallback(() => {
    const selectionType = diagram.selectionState.getSelectionType();
    if (
      selectionType === 'single-node' ||
      selectionType === 'single-label-node' ||
      selectionType === 'single-edge'
    ) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [diagram.selectionState]);

  useEffect(() => {
    callback();

    diagram.selectionState.on('change', callback);
    return () => {
      diagram.selectionState.off('change', callback);
    };
  }, [callback, diagram.selectionState]);

  return (
    <Accordion.Root type="multiple" defaultValue={['indicator', 'named']}>
      {visible && (
        <>
          <DefaultIndicatorPanel />
          <NamedIndicatorPanel />
        </>
      )}
    </Accordion.Root>
  );
};
