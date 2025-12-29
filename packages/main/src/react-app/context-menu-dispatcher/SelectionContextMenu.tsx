import { ActionMenuItem } from '../components/ActionMenuItem';
import { useRedraw } from '../hooks/useRedraw';
import { useEventListener } from '../hooks/useEventListener';
import { useDiagram } from '../../application';
import type { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { ConnectedNodesSubmenu } from './ConnectedNodesSubmenu';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Menu } from '@diagram-craft/app-components/Menu';
import { ShapeNodeDefinition } from '@diagram-craft/canvas/shape/shapeNodeDefinition';

export const SelectionContextMenu = (props: { target: ContextMenuTarget<'selection'> }) => {
  const redraw = useRedraw();
  const diagram = useDiagram();
  const layers = diagram.layers.all.toReversed();

  useEventListener(diagram, 'diagramChange', redraw);

  const isSingleElementInTableRow =
    diagram.selection.elements.length === 1 &&
    isNode(diagram.selection.elements?.[0]?.parent) &&
    diagram.selection.elements[0].parent?.nodeType === 'tableRow';

  return (
    <>
      <ActionMenuItem action={'TEXT_EDIT'} />
      <ActionMenuItem action={'SELECTION_EXECUTE_ACTION'} arg={{}} />
      <Menu.Separator />

      {diagram.selection.type === 'single-edge' && (
        <>
          {/* TODO: Disable this when there's alreay a label */}
          <ActionMenuItem
            action={'EDGE_TEXT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          />
          <ActionMenuItem
            action={'WAYPOINT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          />
          <ActionMenuItem
            action={'WAYPOINT_DELETE'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          />
          <ActionMenuItem action={'EDGE_FLIP'} />
          <Menu.Separator />
        </>
      )}

      {diagram.selection.type === 'single-node' && (
        <>
          <Menu.SubMenu label={'Shape Actions'}>
            {(diagram.selection.nodes[0]!.getDefinition() as ShapeNodeDefinition)
              .getShapeActions(diagram.selection.nodes[0]!)
              .map(e => (
                <ActionMenuItem key={e} action={e} arg={{}} />
              ))}
          </Menu.SubMenu>

          <ConnectedNodesSubmenu />

          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Selection'}>
        <ActionMenuItem action={'SELECT_ALL'} />
        <ActionMenuItem action={'SELECT_ALL_NODES'} />
        <ActionMenuItem action={'SELECT_ALL_EDGES'} />
        <Menu.Separator />
        <ActionMenuItem action={'SELECTION_SELECT_CONNECTED'} />
        <ActionMenuItem action={'SELECTION_SELECT_TREE'} />
        <ActionMenuItem action={'SELECTION_SELECT_GROW'} />
        <ActionMenuItem action={'SELECTION_SELECT_SHRINK'} />
      </Menu.SubMenu>
      <Menu.Separator />

      <ActionMenuItem action={'CLIPBOARD_CUT'} />
      <ActionMenuItem action={'CLIPBOARD_COPY'} />
      <ActionMenuItem action={'DUPLICATE'} />
      <Menu.Separator />

      <ActionMenuItem action={'STYLE_COPY'} arg={{}} />
      <ActionMenuItem action={'STYLE_PASTE'} arg={{}} />
      <Menu.Separator />

      <ActionMenuItem action={'GROUP_GROUP'} />
      <ActionMenuItem action={'GROUP_UNGROUP'} />
      <Menu.Separator />

      <Menu.SubMenu label={'Table'} disabled={!isSingleElementInTableRow}>
        <ActionMenuItem action={'TABLE_COLUMN_INSERT_BEFORE'} />
        <ActionMenuItem action={'TABLE_COLUMN_INSERT_AFTER'} />
        <ActionMenuItem action={'TABLE_COLUMN_REMOVE'} />
        <ActionMenuItem action={'TABLE_COLUMN_DISTRIBUTE'} />
        <ActionMenuItem action={'TABLE_COLUMN_MOVE_LEFT'} />
        <ActionMenuItem action={'TABLE_COLUMN_MOVE_RIGHT'} />
        <Menu.Separator />
        <ActionMenuItem action={'TABLE_ROW_INSERT_BEFORE'} />
        <ActionMenuItem action={'TABLE_ROW_INSERT_AFTER'} />
        <ActionMenuItem action={'TABLE_ROW_REMOVE'} />
        <ActionMenuItem action={'TABLE_ROW_DISTRIBUTE'} />
        <ActionMenuItem action={'TABLE_ROW_MOVE_UP'} />
        <ActionMenuItem action={'TABLE_ROW_MOVE_DOWN'} />
      </Menu.SubMenu>
      <Menu.Separator />

      <Menu.SubMenu label={'Debug'}>
        <ActionMenuItem action={'SELECTION_DUMP'} />
        <ActionMenuItem action={'SELECTION_REDRAW'} />
      </Menu.SubMenu>
      <Menu.Separator />

      {diagram.selection.type === 'single-node' && (
        <>
          <Menu.SubMenu label={'External Data'}>
            <ActionMenuItem action={'ELEMENT_CONVERT_TO_NAME_ELEMENT'}>
              Convert to named element
            </ActionMenuItem>
            <Menu.Separator />
            {diagram.document.data.db.schemas.map(schema => {
              return (
                <Menu.SubMenu key={schema.id} label={schema.name}>
                  <ActionMenuItem action={'EXTERNAL_DATA_LINK'} arg={{ schemaId: schema.id }} />
                  <ActionMenuItem action={'EXTERNAL_DATA_UNLINK'} arg={{ schemaId: schema.id }} />
                  <ActionMenuItem action={'EXTERNAL_DATA_CLEAR'} arg={{ schemaId: schema.id }} />
                  <ActionMenuItem
                    action={'EXTERNAL_DATA_MAKE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  />
                  <ActionMenuItem
                    action={'EXTERNAL_DATA_LINK_UPDATE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  />
                </Menu.SubMenu>
              );
            })}
          </Menu.SubMenu>
          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Geometry'}>
        <ActionMenuItem action={'SELECTION_GEOMETRY_CONVERT_TO_CURVES'} />
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_UNION'} />
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_INTERSECTION'} />
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_A_NOT_B'} />
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_XOR'} />
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_DIVIDE'} />
      </Menu.SubMenu>

      <Menu.SubMenu label={'Layout'}>
        <ActionMenuItem action={'LAYOUT_TREE'} />
        <ActionMenuItem action={'LAYOUT_LAYERED'} />
        <ActionMenuItem action={'LAYOUT_FORCE_DIRECTED'} />
        <ActionMenuItem action={'LAYOUT_ORTHOGONAL'} />
        <ActionMenuItem action={'LAYOUT_SERIES_PARALLEL'} />
      </Menu.SubMenu>

      <Menu.SubMenu label={'Align'}>
        <ActionMenuItem action={'AUTO_ALIGN'} />
        <Menu.Separator />
        <ActionMenuItem action={'ALIGN_TOP'} />
        <ActionMenuItem action={'ALIGN_BOTTOM'} />
        <ActionMenuItem action={'ALIGN_LEFT'} />
        <ActionMenuItem action={'ALIGN_RIGHT'} />
        <Menu.Separator />
        <ActionMenuItem action={'ALIGN_CENTER_HORIZONTAL'} />
        <ActionMenuItem action={'ALIGN_CENTER_VERTICAL'} />
      </Menu.SubMenu>

      <Menu.SubMenu label={'Arrange'} disabled={diagram.selection.elements.length === 1}>
        <ActionMenuItem action={'SELECTION_RESTACK_TOP'} />
        <ActionMenuItem action={'SELECTION_RESTACK_UP'} />
        <ActionMenuItem action={'SELECTION_RESTACK_BOTTOM'} />
        <ActionMenuItem action={'SELECTION_RESTACK_DOWN'} />
      </Menu.SubMenu>

      <Menu.SubMenu label={'Move to'}>
        <ActionMenuItem action={'LAYER_SELECTION_MOVE_NEW'} />
        <Menu.Separator />
        {layers.map(layer => (
          <ActionMenuItem key={layer.id} action={'LAYER_SELECTION_MOVE'} arg={{ id: layer.id }}>
            {layer.name}
          </ActionMenuItem>
        ))}
      </Menu.SubMenu>

      <Menu.Separator />
      <ActionMenuItem action={'SELECTION_ADD_TO_MODIFICATION_LAYER'} />
      <Menu.Separator />
      <ActionMenuItem action={'COMMENT_ADD'} />
    </>
  );
};
