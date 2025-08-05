import { Transform } from './transform';
import { PathList } from './pathList';
import type { Path } from './path';
import { PathListBuilder } from './pathListBuilder';
import { MultiMap } from '@diagram-craft/utils/multimap';
import { VERIFY_NOT_REACHED } from '@diagram-craft/utils/assert';

const transformPath = (path: Path, transformList: Transform[]) => {
  return PathListBuilder.fromSegments(path.start, path.raw)
    .withTransform(transformList)
    .getPaths()
    .singular();
};

export const transformPathList = (pathList: PathList, transformList: Transform[]) => {
  return new PathList(pathList.all().map(p => transformPath(p, transformList)));
};

type Classification = {
  depth: number;
  type: 'outline' | 'hole';
};

export const classifyPathsAsHolesAndOutlines = (paths: Path[]) => {
  const containedWithin = new MultiMap<number, number>();
  for (let a = 0; a < paths.length; a++) {
    for (let b = 0; b < paths.length; b++) {
      if (a === b) continue;
      const pa = paths[a];
      const pb = paths[b];
      if (pa.segments.map(s => s.start).every(p => pb.isInside(p) || pb.isOn(p))) {
        containedWithin.add(a, b);
      }
    }
  }

  const dest = new Map<Path, Classification>();

  let type: Classification = { type: 'outline', depth: 0 };

  let maxLoop = 100;
  const queue = [...paths.map((_, i) => i)];
  while (queue.length > 0) {
    const removed: number[] = [];
    for (const i of queue) {
      const p = paths[i];
      if (!containedWithin.has(i)) {
        removed.push(i);

        dest.set(p, type);
      }
    }

    removed.forEach(j => queue.splice(queue.indexOf(j), 1));
    removed.forEach(r => queue.forEach(q => containedWithin.remove(q, r)));

    type =
      type.type === 'outline'
        ? { type: 'hole', depth: type.depth + 1 }
        : { type: 'outline', depth: type.depth + 1 };

    if (maxLoop-- === 0) {
      VERIFY_NOT_REACHED('Max loop reached');
    }
  }

  return dest;
};
