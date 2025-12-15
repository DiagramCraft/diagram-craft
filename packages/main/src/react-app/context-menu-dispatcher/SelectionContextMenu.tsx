import { ActionContextMenuItem } from '../components/ActionContextMenuItem';
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
      <ActionContextMenuItem action={'TEXT_EDIT'}>Edit...</ActionContextMenuItem>
      <ActionContextMenuItem action={'SELECTION_EXECUTE_ACTION'} arg={{}}>
        Act
      </ActionContextMenuItem>
      <Menu.Separator />

      {diagram.selection.type === 'single-edge' && (
        <>
          {/* TODO: Disable this when there's alreay a label */}
          <ActionContextMenuItem
            action={'EDGE_TEXT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Add text
          </ActionContextMenuItem>
          <ActionContextMenuItem
            action={'WAYPOINT_ADD'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Add waypoint
          </ActionContextMenuItem>
          <ActionContextMenuItem
            action={'WAYPOINT_DELETE'}
            arg={{ point: props.target.pos, id: diagram.selection.edges[0]!.id }}
          >
            Delete waypoint
          </ActionContextMenuItem>
          <ActionContextMenuItem action={'EDGE_FLIP'}>Flip edge</ActionContextMenuItem>
          <Menu.Separator />
        </>
      )}

      {diagram.selection.type === 'single-node' && (
        <>
          <ActionContextMenuItem action={'SELECTION_CHANGE_SHAPE'}>
            Change Shape...
          </ActionContextMenuItem>

          <ConnectedNodesSubmenu />

          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Selection'}>
        <ActionContextMenuItem action={'SELECT_ALL'}>Select All</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECT_ALL_NODES'}>Select All Nodes</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECT_ALL_EDGES'}>Select All Edges</ActionContextMenuItem>
        <Menu.Separator />
        <ActionContextMenuItem action={'SELECTION_SELECT_CONNECTED'}>
          Select Connected
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_SELECT_TREE'}>Select Tree</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_SELECT_GROW'}>Grow</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_SELECT_SHRINK'}>Shrink</ActionContextMenuItem>
      </Menu.SubMenu>
      <Menu.Separator />

      <ActionContextMenuItem action={'CLIPBOARD_CUT'}>Cut</ActionContextMenuItem>
      <ActionContextMenuItem action={'CLIPBOARD_COPY'}>Copy</ActionContextMenuItem>
      <ActionContextMenuItem action={'DUPLICATE'}>Duplicate</ActionContextMenuItem>
      <Menu.Separator />

      <ActionContextMenuItem action={'STYLE_COPY'}>Copy Style</ActionContextMenuItem>
      <ActionContextMenuItem action={'STYLE_PASTE'}>Paste Style</ActionContextMenuItem>
      <Menu.Separator />

      <ActionContextMenuItem action={'GROUP_GROUP'}>Group</ActionContextMenuItem>
      <ActionContextMenuItem action={'GROUP_UNGROUP'}>Ungroup</ActionContextMenuItem>
      <Menu.Separator />

      <Menu.SubMenu label={'Table'} disabled={!isSingleElementInTableRow}>
        <ActionContextMenuItem action={'TABLE_COLUMN_INSERT_BEFORE'}>
          Insert column before
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_COLUMN_INSERT_AFTER'}>
          Insert column after
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_COLUMN_REMOVE'}>Remove column</ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_COLUMN_DISTRIBUTE'}>
          Distribute columns
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_COLUMN_MOVE_LEFT'}>
          Move column left
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_COLUMN_MOVE_RIGHT'}>
          Move column right
        </ActionContextMenuItem>
        <Menu.Separator />
        <ActionContextMenuItem action={'TABLE_ROW_INSERT_BEFORE'}>
          Insert row before
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_ROW_INSERT_AFTER'}>
          Insert row after
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_ROW_REMOVE'}>Remove row</ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_ROW_DISTRIBUTE'}>
          Distribute rows
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_ROW_MOVE_UP'}>Move row up</ActionContextMenuItem>
        <ActionContextMenuItem action={'TABLE_ROW_MOVE_DOWN'}>Move row down</ActionContextMenuItem>
      </Menu.SubMenu>
      <Menu.Separator />

      <Menu.SubMenu label={'Debug'}>
        <ActionContextMenuItem action={'SELECTION_DUMP'}>Dump</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_REDRAW'}>Redraw</ActionContextMenuItem>
      </Menu.SubMenu>
      <Menu.Separator />

      {diagram.selection.type === 'single-node' && (
        <>
          <Menu.SubMenu label={'External Data'}>
            <ActionContextMenuItem action={'ELEMENT_CONVERT_TO_NAME_ELEMENT'}>
              Convert to named element
            </ActionContextMenuItem>
            <Menu.Separator />
            {diagram.document.data.db.schemas.map(schema => {
              return (
                <Menu.SubMenu key={schema.id} label={schema.name}>
                  <ActionContextMenuItem
                    action={'EXTERNAL_DATA_LINK'}
                    arg={{ schemaId: schema.id }}
                  >
                    Link
                  </ActionContextMenuItem>
                  <ActionContextMenuItem
                    action={'EXTERNAL_DATA_UNLINK'}
                    arg={{ schemaId: schema.id }}
                  >
                    Unlink
                  </ActionContextMenuItem>
                  <ActionContextMenuItem
                    action={'EXTERNAL_DATA_CLEAR'}
                    arg={{ schemaId: schema.id }}
                  >
                    Unlink & Clear
                  </ActionContextMenuItem>
                  <ActionContextMenuItem
                    action={'EXTERNAL_DATA_MAKE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  >
                    Make template
                  </ActionContextMenuItem>
                  <ActionContextMenuItem
                    action={'EXTERNAL_DATA_LINK_UPDATE_TEMPLATE'}
                    arg={{ schemaId: schema.id }}
                  >
                    Update template
                  </ActionContextMenuItem>
                </Menu.SubMenu>
              );
            })}
          </Menu.SubMenu>
          <Menu.Separator />
        </>
      )}

      <Menu.SubMenu label={'Geometry'}>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_CONVERT_TO_CURVES'}>
          Convert to curves
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_UNION'}>
          Union
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_INTERSECTION'}>
          Intersect
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_A_NOT_B'}>
          Subtract
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_XOR'}>
          Exclusive Or
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_GEOMETRY_BOOLEAN_DIVIDE'}>
          Divide
        </ActionContextMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Layout'}>
        <ActionContextMenuItem action={'LAYOUT_TREE'}>Tree</ActionContextMenuItem>
        <ActionContextMenuItem action={'LAYOUT_LAYERED'}>Layered</ActionContextMenuItem>
        <ActionContextMenuItem action={'LAYOUT_FORCE_DIRECTED'}>
          Force-Directed
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'LAYOUT_ORTHOGONAL'}>Orthogonal</ActionContextMenuItem>
        <ActionContextMenuItem action={'LAYOUT_SERIES_PARALLEL'}>
          Series-Parallel
        </ActionContextMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Align'}>
        <ActionContextMenuItem action={'AUTO_ALIGN'}>Auto-Align...</ActionContextMenuItem>
        <Menu.Separator />
        <ActionContextMenuItem action={'ALIGN_TOP'}>Align Top Edges</ActionContextMenuItem>
        <ActionContextMenuItem action={'ALIGN_BOTTOM'}>Align Bottom Edges</ActionContextMenuItem>
        <ActionContextMenuItem action={'ALIGN_LEFT'}>Align Left Edges</ActionContextMenuItem>
        <ActionContextMenuItem action={'ALIGN_RIGHT'}>Align Right Edges</ActionContextMenuItem>
        <Menu.Separator />
        <ActionContextMenuItem action={'ALIGN_CENTER_HORIZONTAL'}>
          Align Centers Horizontally
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'ALIGN_CENTER_VERTICAL'}>
          Align Centers Vertically
        </ActionContextMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Arrange'} disabled={diagram.selection.elements.length === 1}>
        <ActionContextMenuItem action={'SELECTION_RESTACK_TOP'}>
          Move to front
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_RESTACK_UP'}>Move forward</ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_RESTACK_BOTTOM'}>
          Move to back
        </ActionContextMenuItem>
        <ActionContextMenuItem action={'SELECTION_RESTACK_DOWN'}>
          Move backward
        </ActionContextMenuItem>
      </Menu.SubMenu>

      <Menu.SubMenu label={'Move to'}>
        <ActionContextMenuItem action={'LAYER_SELECTION_MOVE_NEW'}>
          Create new layer
        </ActionContextMenuItem>
        <Menu.Separator />
        {layers.map(layer => (
          <ActionContextMenuItem
            key={layer.id}
            action={'LAYER_SELECTION_MOVE'}
            arg={{ id: layer.id }}
          >
            {layer.name}
          </ActionContextMenuItem>
        ))}
      </Menu.SubMenu>

      <Menu.Separator />
      <ActionContextMenuItem action={'SELECTION_ADD_TO_MODIFICATION_LAYER'}>
        Add to modification layer
      </ActionContextMenuItem>
      <Menu.Separator />
      <ActionContextMenuItem action={'COMMENT_ADD'}>Add Comment</ActionContextMenuItem>
    </>
  );
};
