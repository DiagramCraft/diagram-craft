import type { DiagramDocument } from './diagramDocument';
import type { Diagram } from './diagram';
import type { Layer } from './diagramLayer';
import { VERIFY_NOT_REACHED, VerifyNotReached } from '@diagram-craft/utils/assert';
import type { RegularLayer } from './diagramLayerRegular';
import { isResolvableToRegularLayer, isResolvableToRuleLayer } from './diagramLayerUtils';
import { type DiagramElement, isEdge, isNode } from './diagramElement';
import type { DiagramNode } from './diagramNode';
import type { DiagramEdge } from './diagramEdge';
import type { RuleLayer } from './diagramLayerRule';

const ref = (k: string | undefined) => (k === undefined ? undefined : ({ ref: k } as const));

export class QueryDocument {
  constructor(private readonly document: DiagramDocument) {}

  get diagrams() {
    return this.document.diagrams.map(d => new QueryDiagram(d));
  }
}

export class QueryDiagram {
  constructor(private readonly diagram: Diagram) {}

  get id() {
    return this.diagram.id;
  }

  get name() {
    return this.diagram.name;
  }

  get diagrams() {
    return this.diagram.diagrams.map(d => new QueryDiagram(d));
  }

  get layers() {
    return this.diagram.layers.all.map(l => QueryLayer.fromLayer(l));
  }

  get parent() {
    return this.diagram.parent;
  }

  get selection() {
    return this.diagram.selection.elements.map(e => QueryElement.fromElement(e));
  }
}

export class QueryLayer {
  constructor(private readonly layer: Layer) {}

  get id() {
    return this.layer.id;
  }

  get name() {
    return this.layer.name;
  }

  get type() {
    return this.layer.type;
  }

  static fromLayer(layer: Layer) {
    if (isResolvableToRegularLayer(layer))
      return new QueryRegularLayer(layer.resolve() as RegularLayer);
    if (isResolvableToRuleLayer(layer)) return new QueryRuleLayer(layer.resolve() as RuleLayer);
    VERIFY_NOT_REACHED();
  }
}

export class QueryRegularLayer extends QueryLayer {
  constructor(private readonly regularLayer: RegularLayer) {
    super(regularLayer);
  }

  get elements() {
    return this.regularLayer.elements.map(e => QueryElement.fromElement(e));
  }

  get allElements() {
    const recurse = (e: DiagramElement): Array<DiagramElement> => {
      return [e, ...e.children.flatMap(recurse)];
    };

    return this.regularLayer.elements.flatMap(recurse).map(e => QueryElement.fromElement(e));
  }
}

export class QueryRuleLayer extends QueryLayer {
  constructor(private readonly ruleLayer: RuleLayer) {
    super(ruleLayer);
  }

  get rules() {
    return this.ruleLayer.rules;
  }
}

export class QueryElement {
  static fromElement(element: DiagramElement): QueryElement {
    if (isNode(element)) return new QueryNode(element);
    if (isEdge(element)) return new QueryEdge(element);
    throw new VerifyNotReached();
  }

  constructor(private readonly element: DiagramElement) {}

  get id() {
    return this.element.id;
  }

  get name() {
    return this.element.name;
  }

  get bounds() {
    return this.element.bounds;
  }

  get children() {
    return this.element.children.map(c => QueryElement.fromElement(c));
  }

  get parent(): QueryElement | undefined {
    return this.element.parent ? QueryElement.fromElement(this.element.parent) : undefined;
  }

  get storedProps() {
    return this.element.storedProps;
  }

  get renderProps() {
    return this.element.renderProps;
  }

  get comments() {
    return this.element.comments.map(c => ({
      message: c.message,
      author: c.author,
      date: c.date,
      id: c.id,
      state: c.state
    }));
  }

  get tags() {
    return this.element.tags;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      children: this.children,
      parent: ref(this.parent?.id),
      props: this.storedProps,
      renderProps: this.renderProps,
      comments: this.comments
    };
  }
}

export class QueryNode extends QueryElement {
  constructor(private readonly node: DiagramNode) {
    super(node);
  }

  get nodeType() {
    return this.node.nodeType;
  }

  get texts() {
    return this.node.texts;
  }

  get edges() {
    return this.node.edges.map(e => new QueryEdge(e));
  }

  get isLabelNode() {
    return this.node.isLabelNode;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      nodeType: this.nodeType,
      texts: this.texts,
      edges: this.edges.map(e => ref(e.id)),
      isLabelNode: this.isLabelNode
    };
  }
}

export class QueryEdge extends QueryElement {
  constructor(private readonly edge: DiagramEdge) {
    super(edge);
  }

  get start() {
    return this.edge.start.serialize();
  }

  get end() {
    return this.edge.end.serialize();
  }

  get isConnected() {
    return this.edge.isConnected;
  }

  get waypoints() {
    return this.edge.waypoints;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      start: this.start,
      end: this.end,
      isConnected: this.isConnected,
      waypoints: this.waypoints
    };
  }
}
