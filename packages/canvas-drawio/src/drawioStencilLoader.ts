import { assert } from '@diagram-craft/utils/assert';
import { xNum } from '@diagram-craft/utils/xml';
import { FileSystem } from '@diagram-craft/canvas-app/loaders';

export type DrawioStencil = {
  key: string;
  group: string;
  props: NodeProps;
  dimensions: { w: number; h: number };
};

export const findStencilByName = (stencils: Array<DrawioStencil>, name: string) => {
  const s = stencils.find(s => s.key.toLowerCase() === name.toLowerCase());
  assert.present(s, `Cannot find stencil ${name}`);
  return s;
};

export const toTypeName = (n: string) => {
  return n.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_').replaceAll("'", '');
};

export const loadDrawioStencils = async (
  url: string,
  group: string,
  foreground = 'black',
  background = 'white'
) => {
  const txt = await FileSystem.loadFromUrl(url);

  const parser = new DOMParser();
  const $doc = parser.parseFromString(txt, 'application/xml');

  const newStencils: Array<DrawioStencil> = [];

  const xmlSerializer = new XMLSerializer();

  const $shapes = $doc.getElementsByTagName('shape');
  for (let i = 0; i < $shapes.length; i++) {
    const name = $shapes[i].getAttribute('name')!;
    newStencils.push({
      group: group,
      key: name,
      props: {
        fill: { color: background },
        stroke: { color: foreground },
        custom: {
          drawio: { shape: btoa(xmlSerializer.serializeToString($shapes[i])) }
        }
      },
      dimensions: {
        w: xNum($shapes[i], 'w'),
        h: xNum($shapes[i], 'h')
      }
    });
  }

  return newStencils;
};
