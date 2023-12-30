import { Line } from '../../geometry/line.ts';
import { Fragment } from 'react';
import { round } from '../../utils/math.ts';
import { DistanceMarker } from './DistanceMarker.tsx';
import { SelectionState } from '../../model/selectionState.ts';

export const Guides = (props: Props) => {
  return [
    ...props.selection.guides.filter(s => s.matchingMagnet.type !== 'distance'),
    ...props.selection.guides.filter(s => s.matchingMagnet.type === 'distance')
  ].map(g => {
    const l = Line.extend(g.line, 30, 30);
    return (
      <Fragment key={`${g.matchingMagnet.type}_${l.from.x},${l.from.y}-${l.to.x},${l.to.y}`}>
        <line
          className={`svg-guide__extension svg-guide__color--${g.matchingMagnet.type}`}
          x1={l.from.x}
          y1={l.from.y}
          x2={l.to.x}
          y2={l.to.y}
        />

        <line
          className={`svg-guide__line svg-guide__color--${g.matchingMagnet.type}`}
          x1={g.line.from.x}
          y1={g.line.from.y}
          x2={g.line.to.x}
          y2={g.line.to.y}
        />

        {g.matchingMagnet.type === 'size' &&
          g.matchingMagnet.distancePairs.map(dp => (
            <DistanceMarker
              key={`${dp.pointA.x}_${dp.pointA.y}`}
              p1={dp.pointA}
              p2={dp.pointB}
              label={round(dp.distance).toString()}
            />
          ))}

        {g.matchingMagnet.type === 'distance' &&
          g.matchingMagnet.distancePairs.map(dp => (
            <DistanceMarker
              key={`${dp.pointA.x}_${dp.pointA.y}`}
              p1={dp.pointA}
              p2={dp.pointB}
              label={round(dp.distance).toString()}
            />
          ))}
      </Fragment>
    );
  });
};

type Props = {
  selection: SelectionState;
};
