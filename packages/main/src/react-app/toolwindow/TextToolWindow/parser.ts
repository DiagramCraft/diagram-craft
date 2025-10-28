type ASTShape = {
  id: string;
} & (
  | {
      type: 'edge';
      from?: string;
      to?: string;
      props?: string;
      metadata?: string;
      children?: ASTShape[];
    }
  | {
      type: 'node';
      shape: string;
      name?: string;
      props?: string;
      metadata?: string;
      children?: ASTShape[];
    }
);

type ParseResult = {
  ast: ASTShape[];
  errors: string[];
};

/**
 * This parses the text and returns the AST as well as
 * an array of errors (indexed by the line number)
 *
 * The input text follows the following format:
 * ```
 * [id]: [type] ("[name]") {
 *   (props: "string")
 *   (metadata: "string")
 *   (children)
 * }
 * [id]: edge (("[from]") -> ("[to]")) ("[label]"){
 *   (props: "string")
 *   (metadata: "string")
 *   (children)
 * }
 * ```
 *
 * Example:
 * ```
 * e1: edge 3 -> 4 "Hello world" {
 *   t2: text "Hello world" {
 *     props: "labelForEdgeId=e1;text.align=center;fill.enabled=true;fill.color=#ffffff"
 *   }
 *   props: "arrow.start.type=SQUARE_ARROW_OUTLINE;arrow.end.type=CROWS_FEET_BAR"
 * }
 *
 * e2: edge
 *
 * 3: rounded-rect "Lorem" {
 *   stylesheet: / h1
 * }
 *
 * 4: rect
 *
 * epb7kko: table {
 *   el4hq06: tableRow {
 *     cukdoml: text "Lorem ipsum" {
 *       props: "stroke.enabled=false;fill.enabled=true"
 *     }
 *     3p0ktgd: text "Dolor sit amet" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#f7edfe"
 *     }
 *     props: "custom.container.containerResize=both;custom.container.layout=horizontal;custom.container.childResize=fill;custom.container.gapType=around;custom.container.gap=0"
 *   }
 *   ekk5sda: tableRow {
 *     nq982mr: text "Consectetur adipiscing elit" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#d2deff"
 *     }
 *     rpvl4ar: text "12345" {
 *       props: "stroke.enabled=false;fill.enabled=true;fill.color=#e9f6e9"
 *     }
 *     props: "custom.container.containerResize=both;custom.container.layout=horizontal;custom.container.childResize=fill;custom.container.gapType=around;custom.container.gap=0"
 *   }
 *   props: "custom.container.containerResize=both;custom.container.layout=vertical;custom.container.childResize=scale;custom.container.gapType=around;custom.container.gap=10;custom.table.gap=0"
 * }
 * ```
 *
 */
export const parse = (text: string): ParseResult => {};
