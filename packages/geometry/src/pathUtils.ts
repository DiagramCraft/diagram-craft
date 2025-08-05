import type { Path } from './path';
import { MultiMap } from '@diagram-craft/utils/multimap';

type Type = 'outline' | 'hole';

export type Hierarchy = {
  depth: number;
  type: Type;
  parent: Path | undefined;
};

const hasSamePath = (existing: number[], path: number[]) => {
  if (existing.length !== path.length) return false;
  for (let i = 0; i < existing.length; i++) {
    if (existing[i] !== path[i]) return false;
  }
  return true;
};

export const constructPathTree = (paths: Path[]) => {
  const childToParents = new MultiMap<number, number>();
  for (let child = 0; child < paths.length; child++) {
    for (let parent = 0; parent < paths.length; parent++) {
      if (child === parent) continue;

      if (
        paths[child].segments
          .map(s => s.start)
          .every(p => paths[parent].isInside(p) || paths[parent].isOn(p))
      ) {
        childToParents.add(child, parent);
      }
    }
  }

  const dest = new Map<Path, Hierarchy>();

  const classifyChildren = (path: number[], depth: number, type: Type) => {
    const parent = path.length === 0 ? undefined : paths[path.at(-1)!];
    const sortedPath = path.toSorted();

    const children: number[] = [];
    for (let childIdx = 0; childIdx < paths.length; childIdx++) {
      const sortedParents = childToParents.get(childIdx).toSorted();

      if (hasSamePath(sortedParents, sortedPath)) {
        dest.set(paths[childIdx], { depth, type, parent });
        children.push(childIdx);
      }
    }

    for (const c of children) {
      classifyChildren([...path, c], depth + 1, type === 'outline' ? 'hole' : 'outline');
    }
  };

  classifyChildren([], 0, 'outline');

  return dest;
};
