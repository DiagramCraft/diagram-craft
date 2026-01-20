import { stringHash } from '@diagram-craft/utils/hash';
import { PathList } from '@diagram-craft/geometry/pathList';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';
import { safeSplit } from '@diagram-craft/utils/safe';
import { PathListBuilder } from '@diagram-craft/geometry/pathListBuilder';
import { Box } from '@diagram-craft/geometry/box';

export type Icon = {
  viewbox: Box;
  pathList: PathList;
  fill?: string;
};

const iconCache = new Map<number, Icon>();

export const getSVGIcon = (s: string) => {
  const key = stringHash(s);
  if (iconCache.has(key)) return iconCache.get(key)!;

  const parser = new DOMParser();
  const $doc = parser.parseFromString(s, 'application/xml');
  const $root = $doc.documentElement;

  const paths: string[] = [];
  const $$children = $root.childNodes;
  for (let i = 0; i < $$children.length; i++) {
    const $child = $$children[i];
    if (!($child instanceof SVGElement)) continue;

    if ($child.tagName === 'path') {
      paths.push($child.getAttribute('d') ?? '');
    } else {
      VERIFY_NOT_REACHED('Only path elements supported');
    }
  }

  const [x, y, w, h] = safeSplit($root.getAttribute('viewBox') ?? '0 0 10 10', ' ', 4, 4);
  const icon = {
    viewbox: { x: parseInt(x), y: parseInt(y), w: parseInt(w), h: parseInt(h), r: 0 },
    pathList: PathListBuilder.fromString(paths.join(' ')).getPaths(),
    fill: $root.getAttribute('fill') ?? undefined
  };
  iconCache.set(key, icon);
  return icon;
};
