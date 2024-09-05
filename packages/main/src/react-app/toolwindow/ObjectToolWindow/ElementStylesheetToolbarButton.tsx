import { useElementMetadata } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '@diagram-craft/app-components/Select';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { isSelectionDirty } from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';
import { TbBaseline, TbPalette } from 'react-icons/tb';
import { DefaultStyles } from '@diagram-craft/model/diagramDefaults';
import { PropertyEditor } from '../../components/PropertyEditor';

export const ElementStylesheetToolbarButton = (props: Props) => {
  const $d = useDiagram();

  const nodeStyles = $d.document.styles.nodeStyles;
  const edgeStyles = $d.document.styles.edgeStyles;
  const textStyles = $d.document.styles.textStyles;

  const style = useElementMetadata($d, 'style', DefaultStyles.node.default);
  const textStyle = useElementMetadata($d, 'textStyle', DefaultStyles.text.default);

  const isDirty = !style.hasMultipleValues && isSelectionDirty($d, false);
  const isTextDirty = !textStyle.hasMultipleValues && isSelectionDirty($d, true);

  if (props.selectionType === 'mixed') return <></>;

  const onValueChange = (v: string | undefined, type: 'style' | 'text-style' = 'style') => {
    const uow = new UnitOfWork($d, true);
    $d.selectionState.elements.forEach(n => {
      $d.document.styles.setStylesheet(n, v!, uow, true);
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
        <PropertyEditor
          property={style}
          render={props => (
            <Select.Root {...props} onChange={onValueChange}>
              {nodeStyles.map(e => (
                <Select.Item key={e.id} value={e.id}>
                  {isDirty && e.id === style.val ? `${e.name} ∗` : e.name}
                </Select.Item>
              ))}
            </Select.Root>
          )}
        />

        <div className={'cmp-toolbar__button'} style={{ marginLeft: '0.5rem' }}>
          <TbBaseline />
        </div>
        <PropertyEditor
          property={textStyle}
          render={props => (
            <Select.Root {...props} onChange={v => onValueChange(v, 'text-style')}>
              {textStyles.map(e => (
                <Select.Item key={e.id} value={e.id}>
                  {isTextDirty && e.id === textStyle.val ? `${e.name} ∗` : e.name}
                </Select.Item>
              ))}
            </Select.Root>
          )}
        />

        <Toolbar.Separator style={{ marginRight: '5px' }} />
      </>
    );
  } else {
    return (
      <>
        <div className={'cmp-toolbar__button'}>
          <TbPalette />
        </div>
        <PropertyEditor
          property={style}
          render={props => (
            <Select.Root {...props} onChange={onValueChange}>
              {edgeStyles.map(e => (
                <Select.Item key={e.id} value={e.id}>
                  {isDirty && e.id === style.val ? `${e.name} ∗` : e.name}
                </Select.Item>
              ))}
            </Select.Root>
          )}
        />

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
