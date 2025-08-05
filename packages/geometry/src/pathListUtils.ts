import { Transform } from './transform';
import { PathList } from './pathList';
import type { Path } from './path';
import { PathListBuilder } from './pathListBuilder';

const transformPath = (path: Path, transformList: Transform[]) => {
  return PathListBuilder.fromSegments(path.start, path.raw)
    .withTransform(transformList)
    .getPaths()
    .singular();
};

export const transformPathList = (pathList: PathList, transformList: Transform[]) => {
  return new PathList(pathList.all().map(p => transformPath(p, transformList)));
};
