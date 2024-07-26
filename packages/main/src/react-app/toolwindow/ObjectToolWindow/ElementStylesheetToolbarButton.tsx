import { useElementProperty, useNodeProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '@diagram-craft/app-components/Select';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { isSelectionDirty } from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TbBaseline, TbPalette } from 'react-icons/tb';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';

export const ElementStylesheetToolbarButton = (props: Props) => {
  const $d = useDiagram();

  const nodeStyles = $d.document.styles.nodeStyles;
  const edgeStyles = $d.document.styles.edgeStyles;
  const textStyles = $d.document.styles.textStyles;

  const style = useElementProperty($d, 'style', DefaultStyles.node.default);
  const textStyle = useNodeProperty($d, 'text.style', DefaultStyles.text.default);

  const isDirty = !style.hasMultipleValues && isSelectionDirty($d, false);
  const isTextDirty = !textStyle.hasMultipleValues && isSelectionDirty($d, true);

  if (props.selectionType === 'mixed') return <></>;

  const onValueChange = (v: string, type: 'style' | 'text-style' = 'style') => {
    const uow = new UnitOfWork($d, true);
    $d.selectionState.elements.forEach(n => {
      $d.document.styles.setStylesheet(n, v, uow, true);
    });
    if (type === 'style') style.set(v);
    else {
      textStyle.set(v);
    }
    commitWithUndo(uow, 'Change stylesheet');
  };

  if (
    props.selectionType === 'nodes' ||
    props.selectionType === 'single-node' ||
    props.selectionType === 'single-label-node'
  ) {
    return (
      <>
        <div className={'cmp-toolbar__button'}>
          <TbPalette />
        </div>
        <Select.Root
          value={style.val}
          onValueChange={onValueChange}
          hasMultipleValues={style.hasMultipleValues}
        >
          {nodeStyles.map(e => (
            <Select.Item key={e.id} value={e.id}>
              {isDirty && e.id === style.val ? `${e.name} ∗` : e.name}
            </Select.Item>
          ))}
        </Select.Root>

        <div className={'cmp-toolbar__button'} style={{ marginLeft: '0.5rem' }}>
          <TbBaseline />
        </div>
        <Select.Root
          value={textStyle.val}
          onValueChange={v => onValueChange(v, 'text-style')}
          hasMultipleValues={textStyle.hasMultipleValues}
        >
          {textStyles.map(e => (
            <Select.Item key={e.id} value={e.id}>
              {isTextDirty && e.id === textStyle.val ? `${e.name} ∗` : e.name}
            </Select.Item>
          ))}
        </Select.Root>

        <Toolbar.Separator style={{ marginRight: '5px' }} />
      </>
    );
  } else {
    return (
      <>
        <div className={'cmp-toolbar__button'}>
          <TbPalette />
        </div>
        <Select.Root
          value={style.val}
          onValueChange={onValueChange}
          hasMultipleValues={style.hasMultipleValues}
        >
          {edgeStyles.map(e => (
            <Select.Item key={e.id} value={e.id}>
              {isDirty && e.id === style.val ? `${e.name} ∗` : e.name}
            </Select.Item>
          ))}
        </Select.Root>
        <Toolbar.Separator style={{ marginRight: '0px' }} />
      </>
    );
  }
};

interface Props {
  value?: string;
  selectionType: SelectionType | undefined;
  nodeType: string | undefined;
  //  onValueChange: (value: string | undefined) => void;
}
