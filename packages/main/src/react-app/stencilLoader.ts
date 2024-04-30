import { Stencil } from '@diagram-craft/model/elementDefinitionRegistry';
import { DrawioShapeNodeDefinition } from '@diagram-craft/canvas-app/drawio/DrawioShape.nodeType';

export const loadStencil = async (
  url: string,
  group: string,
  foreground: string,
  background: string
) => {
  const res = await fetch(url);
  const txt = await res.text();

  const parser = new DOMParser();
  const $doc = parser.parseFromString(txt, 'application/xml');

  const newStencils: Array<Stencil> = [];

  const xmlSerializer = new XMLSerializer();

  const $shapes = $doc.getElementsByTagName('shape');
  for (let i = 0; i < $shapes.length; i++) {
    const name = $shapes[i].getAttribute('name')!;
    newStencils.push({
      node: new DrawioShapeNodeDefinition(),
      group: group,
      key: name,
      props: {
        fill: { color: background },
        stroke: { color: foreground },
        drawio: { shape: btoa(xmlSerializer.serializeToString($shapes[i])) }
      }
    });
  }

  return newStencils;
};
