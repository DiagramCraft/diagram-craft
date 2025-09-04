import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { TbCircleArrowRightFilled, TbCircleDotted } from 'react-icons/tb';
import { useDiagram } from '../../../application';
import { $c } from '@diagram-craft/utils/classname';
import * as Tabs from '@radix-ui/react-tabs';
import { useState } from 'react';

const formatTimestamp = (ts: Date | undefined) => {
  if (!ts) {
    return '';
  }
  return '[' + ts.toLocaleTimeString() + ']';
};

export const HistoryToolWindow = () => {
  const [tab, setTab] = useState<string>('undo');
  const diagram = useDiagram();
  const redraw = useRedraw();
  useEventListener(diagram.undoManager, 'change', redraw);

  const redoActions = diagram.undoManager.redoableActions;
  const undoActions = diagram.undoManager.undoableActions.toReversed();

  return (
    <Tabs.Root className={'cmp-tool-tabs'} value={tab} onValueChange={e => setTab(e)}>
      <Tabs.List className={$c('cmp-tool-tabs__tabs', { hidden: false })}>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'undo'}>
          Undo Stack
        </Tabs.Trigger>
        <Tabs.Trigger className="cmp-tool-tabs__tab-trigger util-vcenter" value={'history'}>
          Document History
        </Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value={'undo'}>
        <div className={'cmp-panel__headless'} style={{ fontSize: '11px' }}>
          <div className={'util-vstack'}>
            {redoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                <TbCircleDotted />
                <span>
                  {a.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
            {undoActions.map((a, idx) => (
              <div key={idx} className={'util-vcenter util-hgap'}>
                {idx === 0 && <TbCircleArrowRightFilled />}
                {idx !== 0 && <TbCircleDotted />}
                <span>
                  {a.description} {formatTimestamp(a.timestamp)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Tabs.Content>
    </Tabs.Root>
  );
};
