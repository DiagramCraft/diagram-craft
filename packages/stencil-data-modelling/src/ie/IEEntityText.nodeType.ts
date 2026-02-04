// NodeDefinition and Shape *****************************************************

import {
  ShapeNodeDefinition,
  TextHandler,
  TextHandlers
} from '@diagram-craft/canvas/shape/shapeNodeDefinition';
import {
  BaseNodeComponent,
  BaseShapeBuildShapeProps
} from '@diagram-craft/canvas/components/BaseNodeComponent';
import { ShapeBuilder } from '@diagram-craft/canvas/shape/ShapeBuilder';
import { DiagramNode } from '@diagram-craft/model/diagramNode';

const toHTML = (s: string) => {
  const dest: string[] = [];

  dest.push(
    `<div style="display: grid; grid-template-columns: 1fr min-content min-content; column-gap: 0.25rem;">`
  );

  for (const lineRaw of s.split('\n')) {
    const line = lineRaw.replaceAll('&gt;', '>').replaceAll('&lt;', '<');
    const elements = line.split(/</g).map(e => e.trim());

    const row = [elements[0]!, '', ''];

    if (elements.includes('M>')) row[2] = '&lt;M&gt;';
    if (elements.includes('pi>')) {
      row[1] = '&lt;pi&gt;';
      row[0] = `<u>${row[0]}</u>`;
    }
    if (elements.includes('ai>')) row[1] = '&lt;ai&gt;';

    dest.push(row.map(e => `<div>${e}</div>`).join(''));
  }

  dest.push(`</div>`);
  return dest.join('');
};

export class IEEntityTextNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'dataModellingIeEntityText', displayName = 'IE Entity Text') {
    super(name, displayName, IEEntityTextNodeDefinition.Shape);
  }

  getTextHandler(_node: DiagramNode): TextHandlers {
    const handler: TextHandler = {
      storedToEdit: s => s,
      editToStored: s => s,
      storedToHTML: s => toHTML(s)
    };
    return {
      dialog: handler,
      inline: handler
    };
  }

  static Shape = class extends BaseNodeComponent<IEEntityTextNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      super.buildShape(props, builder);
    }
  };
}
