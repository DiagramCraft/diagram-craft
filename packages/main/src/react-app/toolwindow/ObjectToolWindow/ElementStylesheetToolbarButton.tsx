import { useElementProperty } from '../../hooks/useProperty';
import { useDiagram } from '../../context/DiagramContext';
import { Select } from '@diagram-craft/app-components/Select';
import { SelectionType } from '@diagram-craft/model/selectionState';
import { Toolbar } from '@diagram-craft/app-components/Toolbar';
import { isPropsDirty } from '@diagram-craft/model/diagramStyles';
import { UnitOfWork } from '@diagram-craft/model/unitOfWork';
import { commitWithUndo } from '@diagram-craft/model/diagramUndoActions';

export const ElementStylesheetToolbarButton = (props: Props) => {
  const $d = useDiagram();

  const nodeStyles = $d.document.styles.nodeStyles;
  const edgeStyles = $d.document.styles.edgeStyles;

  const style = useElementProperty($d, 'style', 'default');

  const stylesheet = $d.document.styles.get($d.selectionState.elements[0].renderProps.style!);

  const isDirty =
    !style.hasMultipleValues &&
    $d.selectionState.elements.some(e => isPropsDirty(e.renderProps, stylesheet?.props ?? {}));

  if (props.selectionType === 'mixed') return <></>;

  const onValueChange = (v: string) => {
    const uow = new UnitOfWork($d, true);
    $d.selectionState.elements.forEach(n => {
      $d.document.styles.setStylesheet(n, v, uow, true);
    });
    style.set(v);
    commitWithUndo(uow, 'Change stylesheet');
  };

  if (
    props.selectionType === 'nodes' ||
    props.selectionType === 'single-node' ||
    props.selectionType === 'single-label-node'
  ) {
    return (
      <>
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
        <Toolbar.Separator style={{ marginRight: '5px' }} />
      </>
    );
  } else {
    return (
      <>
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
