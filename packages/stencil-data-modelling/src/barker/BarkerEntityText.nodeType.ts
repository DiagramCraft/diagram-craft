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
    `<div style="display: grid; grid-template-columns: min-content 1fr; column-gap: 0.25rem;">`
  );

  for (const lineRaw of s.split('\n')) {
    const line = lineRaw.replaceAll('&gt;', '>').replaceAll('&lt;', '<');

    if (line.trim().length === 0) continue;

    const row = [line[0]!, line.slice(1).trim()];

    if (row[0] === '#') {
      row[1] = `<u>${row[1]}</u>`;
    }

    dest.push(row.map(e => `<div>${e}</div>`).join(''));
  }

  dest.push(`</div>`);
  return dest.join('');
};

export class BarkerEntityTextNodeDefinition extends ShapeNodeDefinition {
  constructor(name = 'dataModellingBarkerEntityText', displayName = 'Barker Entity Text') {
    super(name, displayName, BarkerEntityTextNodeDefinition.Shape);
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

  static Shape = class extends BaseNodeComponent<BarkerEntityTextNodeDefinition> {
    buildShape(props: BaseShapeBuildShapeProps, builder: ShapeBuilder) {
      super.buildShape(props, builder);
    }
  };
}
