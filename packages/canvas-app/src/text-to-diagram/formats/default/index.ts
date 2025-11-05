import type { DiagramFormat } from '../../types';
import { defaultParser } from './parser';
import { defaultSerializer } from './serializer';
import { defaultSyntaxHighlighter } from './syntaxHighlighter';

/**
 * Default diagram text format
 *
 * This format uses a custom syntax designed for Diagram Craft.
 *
 * ## Formal Grammar
 *
 * ```ebnf
 * (* Top-level structure *)
 * diagram = { element } ;
 * element = [id] ":" (node | edge) ;
 *
 * (* Identifiers *)
 * id = ID | STRING ;
 * ID = (letter | digit | "_" | "-")+ ;
 * STRING = '"' { character | escape_sequence } '"' ;
 *
 * (* Node definition *)
 * node = shape [name] [body] ;
 * shape = ID ;
 * name = STRING ;
 *
 * (* Edge definition *)
 * edge = "edge" [connection] [label] [body] ;
 * connection = [id] [arrow] [id] ;
 * arrow = "->" ;
 * label = STRING ;
 *
 * (* Body with properties and children *)
 * body = "{" { body_item } "}" ;
 * body_item = props | metadata | stylesheet | element ;
 *
 * (* Properties *)
 * props = "props" ":" STRING ;
 * metadata = "metadata" ":" STRING ;
 * stylesheet = "stylesheet" ":" [style_id] "/" [textstyle_id]
 *            | "stylesheet" ":" style_id ["/"]
 *            | "stylesheet" ":" "/" textstyle_id ;
 * style_id = ID ;
 * textstyle_id = ID ;
 * ```
 *
 * ## Key Features
 *
 * **Element IDs:**
 * - IDs can be explicit (`node1: rect`) or omitted (`: rect`)
 * - When omitted, a unique ID is auto-generated
 * - Auto-generated IDs appear in serialized output
 * - Nodes referenced by edges must have explicit IDs
 *
 * **Node Types:**
 * - Built-in shapes: `rect`, `circle`, `text`, `rounded-rect`, `table`, etc.
 * - Custom shapes can be registered via the node registry
 *
 * **Edge Connections:**
 * - Full connection: `edge node1 -> node2`
 * - From only: `edge node1 ->`
 * - To only: `edge -> node2`
 * - Unconnected: `edge`
 *
 * **Properties Format:**
 * - Nested properties: `"stroke.enabled=false;fill.color=#ff0000"`
 * - Boolean values: `true`, `false`
 * - Numbers: `42`, `3.14`
 *
 * **Quoted IDs:**
 * - IDs with spaces must be quoted: `"my node": rect`
 * - Simple IDs can be unquoted: `node1: rect`
 *
 * ## Examples
 *
 * ```
 * // Simple nodes with explicit IDs
 * node1: rect "Hello"
 * node2: circle "World"
 *
 * // Node with auto-generated ID
 * : text "Auto ID"
 *
 * // Node with properties and styles
 * node3: rounded-rect "Styled" {
 *   stylesheet: primary / h1
 *   props: "fill.color=#ff0000"
 * }
 *
 * // Edge with connection
 * e1: edge node1 -> node2 "connects to"
 *
 * // Edge with auto-generated ID
 * : edge node2 -> node3
 *
 * // Nested structure (table)
 * table1: table {
 *   row1: tableRow {
 *     cell1: text "A"
 *     : text "B"
 *   }
 * }
 * ```
 */
export const defaultFormat: DiagramFormat = {
  id: 'default',
  name: 'Default',
  description: 'Default Diagram Craft text format',
  parser: defaultParser,
  serializer: defaultSerializer,
  syntaxHighlighter: defaultSyntaxHighlighter
};
