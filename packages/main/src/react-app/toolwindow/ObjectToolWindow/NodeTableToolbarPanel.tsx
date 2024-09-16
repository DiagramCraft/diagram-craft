import { ToolWindowPanel } from '../ToolWindowPanel';
import { ActionToolbarButton } from '../../toolbar/ActionToolbarButton';
import {
  TbColumnInsertLeft,
  TbColumnInsertRight,
  TbColumnRemove,
  TbColumns2,
  TbLayoutRows,
  TbRowInsertBottom,
  TbRowInsertTop,
  TbRowRemove
} from 'react-icons/tb';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { useRedraw } from '../../hooks/useRedraw';
import { useEventListener } from '../../hooks/useEventListener';
import { useTable } from '../../hooks/useTable';
import { useDiagram } from '../../../application';

export const NodeTableToolbarPanel = () => {
  const diagram = useDiagram();
  const redraw = useRedraw();
  const element = useTable(diagram);

  useEventListener(diagram, 'elementChange', redraw);

  if (!element) {
    return <div></div>;
  }

  return (
    <ToolWindowPanel mode={'headless'} title={''} id={'custom'}>
      <Toolbar.Root>
        <ActionToolbarButton action={'TABLE_COLUMN_INSERT_BEFORE'}>
          <TbColumnInsertLeft className={'svg__insert'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_COLUMN_INSERT_AFTER'}>
          <TbColumnInsertRight className={'svg__insert'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_COLUMN_REMOVE'}>
          <TbColumnRemove className={'svg__remove'} />
        </ActionToolbarButton>

        <ActionToolbarButton action={'TABLE_ROW_INSERT_BEFORE'}>
          <TbRowInsertTop className={'svg__insert'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_ROW_INSERT_AFTER'}>
          <TbRowInsertBottom className={'svg__insert'} />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_ROW_REMOVE'}>
          <TbRowRemove className={'svg__remove'} />
        </ActionToolbarButton>

        <Toolbar.Separator />

        <ActionToolbarButton action={'TABLE_COLUMN_DISTRIBUTE'}>
          <TbColumns2 />
        </ActionToolbarButton>
        <ActionToolbarButton action={'TABLE_ROW_DISTRIBUTE'}>
          <TbLayoutRows />
        </ActionToolbarButton>
      </Toolbar.Root>
    </ToolWindowPanel>
  );
};
