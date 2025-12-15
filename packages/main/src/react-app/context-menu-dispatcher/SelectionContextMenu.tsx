import { ActionMenuItem } from '../components/ActionMenuItem';
import { useRedraw } from '../hooks/useRedraw';
import { useEventListener } from '../hooks/useEventListener';
import { useDiagram } from '../../application';
import type { ContextMenuTarget } from '@diagram-craft/canvas/context';
import { ConnectedNodesSubmenu } from './ConnectedNodesSubmenu';
import { isNode } from '@diagram-craft/model/diagramElement';
import { Menu } from '@diagram-craft/app-components/Menu';

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
      <ActionMenuItem action={'TEXT_EDIT'}>Edit...</ActionMenuItem>
      <ActionMenuItem action={'SELECTION_EXECUTE_ACTION'} arg={{}}>
        Act
      </ActionMenuItem>
      <Menu.Separator />

      {diagram.selection.type === 'single-edge' && (
        <>
          {/* TODO: Disable this when there's alreay a label */}
          <ActionMenuItem
            action={'EDGE_TEXT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Add text
          </ActionMenuItem>
          <ActionMenuItem
            action={'WAYPOINT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Add waypoint
          </ActionMenuItem>
          <ActionMenuItem
            action={'WAYPOINT_DELETE'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Delete waypoint
          </ActionMenuItem>
          <ActionMenuItem action={'EDGE_FLIP'}>Flip edge</ActionMenuItem>
          <Menu.Separator />
        </>
      )}

      {diagram.selection.type === 'single-node' && (
        <>
          <ActionMenuItem action={'SELECTION_CHANGE_SHAPE'}>Change Shape...</ActionMenuItem>

          <ConnectedNodesSubmenu />

          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Selection'}>
        <ActionMenuItem action={'SELECT_ALL'}>Select All</ActionMenuItem>
        <ActionMenuItem action={'SELECT_ALL_NODES'}>Select All Nodes</ActionMenuItem>
        <ActionMenuItem action={'SELECT_ALL_EDGES'}>Select All Edges</ActionMenuItem>
        <Menu.Separator />
        <ActionMenuItem action={'SELECTION_SELECT_CONNECTED'}>Select Connected</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_SELECT_TREE'}>Select Tree</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_SELECT_GROW'}>Grow</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_SELECT_SHRINK'}>Shrink</ActionMenuItem>
      </Menu.SubMenu>
      <Menu.Separator />

      <ActionMenuItem action={'CLIPBOARD_CUT'}>Cut</ActionMenuItem>
      <ActionMenuItem action={'CLIPBOARD_COPY'}>Copy</ActionMenuItem>
      <ActionMenuItem action={'DUPLICATE'}>Duplicate</ActionMenuItem>
      <Menu.Separator />

      <ActionMenuItem action={'STYLE_COPY'}>Copy Style</ActionMenuItem>
      <ActionMenuItem action={'STYLE_PASTE'}>Paste Style</ActionMenuItem>
      <Menu.Separator />

      <ActionMenuItem action={'GROUP_GROUP'}>Group</ActionMenuItem>
      <ActionMenuItem action={'GROUP_UNGROUP'}>Ungroup</ActionMenuItem>
      <Menu.Separator />

      <Menu.SubMenu label={'Table'} disabled={!isSingleElementInTableRow}>
        <ActionMenuItem action={'TABLE_COLUMN_INSERT_BEFORE'}>Insert column before</ActionMenuItem>
        <ActionMenuItem action={'TABLE_COLUMN_INSERT_AFTER'}>Insert column after</ActionMenuItem>
        <ActionMenuItem action={'TABLE_COLUMN_REMOVE'}>Remove column</ActionMenuItem>
        <ActionMenuItem action={'TABLE_COLUMN_DISTRIBUTE'}>Distribute columns</ActionMenuItem>
        <ActionMenuItem action={'TABLE_COLUMN_MOVE_LEFT'}>Move column left</ActionMenuItem>
        <ActionMenuItem action={'TABLE_COLUMN_MOVE_RIGHT'}>Move column right</ActionMenuItem>
        <Menu.Separator />
        <ActionMenuItem action={'TABLE_ROW_INSERT_BEFORE'}>Insert row before</ActionMenuItem>
        <ActionMenuItem action={'TABLE_ROW_INSERT_AFTER'}>Insert row after</ActionMenuItem>
        <ActionMenuItem action={'TABLE_ROW_REMOVE'}>Remove row</ActionMenuItem>
        <ActionMenuItem action={'TABLE_ROW_DISTRIBUTE'}>Distribute rows</ActionMenuItem>
        <ActionMenuItem action={'TABLE_ROW_MOVE_UP'}>Move row up</ActionMenuItem>
        <ActionMenuItem action={'TABLE_ROW_MOVE_DOWN'}>Move row down</ActionMenuItem>
      </Menu.SubMenu>
      <Menu.Separator />

      <Menu.SubMenu label={'Debug'}>
        <ActionMenuItem action={'SELECTION_DUMP'}>Dump</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_REDRAW'}>Redraw</ActionMenuItem>
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
                  <ActionMenuItem action={'EXTERNAL_DATA_LINK'} arg={{ schemaId: schema.id }}>
                    Link
                  </ActionMenuItem>
                  <ActionMenuItem action={'EXTERNAL_DATA_UNLINK'} arg={{ schemaId: schema.id }}>
                    Unlink
                  </ActionMenuItem>
                  <ActionMenuItem action={'EXTERNAL_DATA_CLEAR'} arg={{ schemaId: schema.id }}>
                    Unlink & Clear
                  </ActionMenuItem>
                  <ActionMenuItem
                    action={'EXTERNAL_DATA_MAKE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  >
                    Make template
                  </ActionMenuItem>
                  <ActionMenuItem
                    action={'EXTERNAL_DATA_LINK_UPDATE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  >
                    Update template
                  </ActionMenuItem>
                </Menu.SubMenu>
              );
            })}
          </Menu.SubMenu>
          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Geometry'}>
        <ActionMenuItem action={'SELECTION_GEOMETRY_CONVERT_TO_CURVES'}>
          Convert to curves
        </ActionMenuItem>
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_UNION'}>Union</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_INTERSECTION'}>
          Intersect
        </ActionMenuItem>
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_A_NOT_B'}>Subtract</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_XOR'}>Exclusive Or</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_DIVIDE'}>Divide</ActionMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Layout'}>
        <ActionMenuItem action={'LAYOUT_TREE'}>Tree</ActionMenuItem>
        <ActionMenuItem action={'LAYOUT_LAYERED'}>Layered</ActionMenuItem>
        <ActionMenuItem action={'LAYOUT_FORCE_DIRECTED'}>Force-Directed</ActionMenuItem>
        <ActionMenuItem action={'LAYOUT_ORTHOGONAL'}>Orthogonal</ActionMenuItem>
        <ActionMenuItem action={'LAYOUT_SERIES_PARALLEL'}>Series-Parallel</ActionMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Align'}>
        <ActionMenuItem action={'AUTO_ALIGN'}>Auto-Align...</ActionMenuItem>
        <Menu.Separator />
        <ActionMenuItem action={'ALIGN_TOP'}>Align Top Edges</ActionMenuItem>
        <ActionMenuItem action={'ALIGN_BOTTOM'}>Align Bottom Edges</ActionMenuItem>
        <ActionMenuItem action={'ALIGN_LEFT'}>Align Left Edges</ActionMenuItem>
        <ActionMenuItem action={'ALIGN_RIGHT'}>Align Right Edges</ActionMenuItem>
        <Menu.Separator />
        <ActionMenuItem action={'ALIGN_CENTER_HORIZONTAL'}>
          Align Centers Horizontally
        </ActionMenuItem>
        <ActionMenuItem action={'ALIGN_CENTER_VERTICAL'}>Align Centers Vertically</ActionMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Arrange'} disabled={diagram.selection.elements.length === 1}>
        <ActionMenuItem action={'SELECTION_RESTACK_TOP'}>Move to front</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_RESTACK_UP'}>Move forward</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_RESTACK_BOTTOM'}>Move to back</ActionMenuItem>
        <ActionMenuItem action={'SELECTION_RESTACK_DOWN'}>Move backward</ActionMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Move to'}>
        <ActionMenuItem action={'LAYER_SELECTION_MOVE_NEW'}>Create new layer</ActionMenuItem>
        <Menu.Separator />
        {layers.map(layer => (
          <ActionMenuItem key={layer.id} action={'LAYER_SELECTION_MOVE'} arg={{ id: layer.id }}>
            {layer.name}
          </ActionMenuItem>
        ))}
      </Menu.SubMenu>

      <Menu.Separator />
      <ActionMenuItem action={'SELECTION_ADD_TO_MODIFICATION_LAYER'}>
        Add to modification layer
      </ActionMenuItem>
      <Menu.Separator />
      <ActionMenuItem action={'COMMENT_ADD'}>Add Comment</ActionMenuItem>
    </>
  );
};
